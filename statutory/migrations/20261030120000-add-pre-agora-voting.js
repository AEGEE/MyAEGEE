// Pre-Agora Voting (Working Format of the Agora, Art. 20): a voting can now happen online
// before the Agora, by the delegates of the coming Agora. The phase of a voting decides
// who can vote, the majority, whether a quorum counts and whether the result is published by itself.
// A voting on the Agora (phase 'agora', the default) works as before.

// Who can vote, checked again on every vote. Only this check depends on the phase.
const delegateCheck = (withPhase) => (withPhase ? `
                -- A voting on the Agora: the delegate must still be in the hall (checked in, not departed).
                -- A Pre-Agora voting: the delegate must still be a delegate of the coming Agora;
                -- check-in and departure are about the hall, so they do not matter before the Agora.
                -- The votes of a refused delegate do not go to the other delegates of the body.
                IF voting_phase = 'pre_agora' THEN
                    PERFORM 1 FROM applications
                        WHERE id = NEW.application_id AND participant_type = 'delegate'
                        AND status = 'accepted' AND confirmed AND NOT cancelled;
                    IF NOT FOUND THEN
                        RAISE EXCEPTION USING ERRCODE = 'check_violation', CONSTRAINT = 'delegate_withdrawn',
                            MESSAGE = 'This delegate is not a delegate of this Agora any more.';
                    END IF;
                ELSE
                    PERFORM 1 FROM applications
                        WHERE id = NEW.application_id AND participant_type = 'delegate'
                        AND confirmed AND registered AND NOT departed AND NOT cancelled;
                    IF NOT FOUND THEN
                        RAISE EXCEPTION USING ERRCODE = 'check_violation', CONSTRAINT = 'delegate_not_present',
                            MESSAGE = 'This delegate is not present any more.';
                    END IF;
                END IF;` : `
                -- A delegate who departed or was cancelled after the voting opened cannot vote.
                -- The votes of this delegate do not go to the other delegates of the body.
                PERFORM 1 FROM applications
                    WHERE id = NEW.application_id AND participant_type = 'delegate'
                    AND confirmed AND registered AND NOT departed AND NOT cancelled;
                IF NOT FOUND THEN
                    RAISE EXCEPTION USING ERRCODE = 'check_violation', CONSTRAINT = 'delegate_not_present',
                        MESSAGE = 'This delegate is not present any more.';
                END IF;`);

// The trigger function of migrations/20261029120000-create-votings.js; up adds the phase, down restores it.
const countDelegateVotes = (withPhase) => `
            CREATE OR REPLACE FUNCTION count_delegate_votes() RETURNS trigger AS $$
            DECLARE
                old_total     integer;
                new_total     integer;
                voting_status    text;
                voting_closes_at timestamptz;${withPhase ? `
                voting_phase     text;` : ''}
            BEGIN
                -- Rows are created empty when the voting opens; votes only come in through an UPDATE.
                IF TG_OP = 'INSERT' THEN
                    IF NEW.in_favour + NEW.against + NEW.abstention <> 0 OR NEW.submitted_at IS NOT NULL THEN
                        RAISE EXCEPTION USING ERRCODE = 'check_violation', CONSTRAINT = 'votes_start_empty',
                            MESSAGE = 'A delegate row must be created without votes.';
                    END IF;
                    RETURN NEW;
                END IF;

                IF NEW.voting_id <> OLD.voting_id OR NEW.application_id <> OLD.application_id
                    OR NEW.user_id <> OLD.user_id OR NEW.body_id <> OLD.body_id OR NEW.max_votes <> OLD.max_votes THEN
                    RAISE EXCEPTION USING ERRCODE = 'check_violation', CONSTRAINT = 'snapshot_is_fixed',
                        MESSAGE = 'The snapshot of a delegate cannot change.';
                END IF;

                -- A delegate votes once and cannot change the vote.
                IF OLD.submitted_at IS NOT NULL THEN
                    RAISE EXCEPTION USING ERRCODE = 'check_violation', CONSTRAINT = 'already_voted',
                        MESSAGE = 'This delegate has already voted.';
                END IF;

                -- The share lock makes closing the voting wait until this vote is stored.
                -- A vote after closes_at is refused even when the voting is not marked closed yet.
                SELECT status, closes_at${withPhase ? ', phase' : ''} INTO voting_status, voting_closes_at${withPhase ? ', voting_phase' : ''} FROM votings WHERE id = NEW.voting_id FOR SHARE;
                IF voting_status IS DISTINCT FROM 'open' OR now() >= voting_closes_at THEN
                    RAISE EXCEPTION USING ERRCODE = 'check_violation', CONSTRAINT = 'voting_not_open',
                        MESSAGE = 'This voting is not open.';
                END IF;
${delegateCheck(withPhase)}

                old_total := OLD.in_favour + OLD.against + OLD.abstention;
                new_total := NEW.in_favour + NEW.against + NEW.abstention;
                NEW.submitted_at := now();

                UPDATE voting_body_allotments
                    SET votes_cast = votes_cast + new_total - old_total,
                        delegates_above_min = delegates_above_min
                            + (new_total > min_votes)::integer - (old_total > min_votes)::integer
                    WHERE voting_id = NEW.voting_id AND body_id = NEW.body_id;

                RETURN NEW;
            END
            $$ LANGUAGE plpgsql;`;

module.exports = {
    up: (queryInterface) => queryInterface.sequelize.transaction(async (transaction) => {
        await queryInterface.sequelize.query(`
            ALTER TABLE votings
                ADD COLUMN phase text NOT NULL DEFAULT 'agora' CHECK (phase IN ('agora', 'pre_agora')),
                -- Set by the JC when creating the voting: a change of the Statutes or the
                -- Convention d'Adhesion always gets a new voting on the Agora (Art. 20(5)).
                ADD COLUMN concerns_statutes boolean NOT NULL DEFAULT false,
                -- Set by the JC: an amendment came in at least five days before the Agora (Art. 20(5)).
                ADD COLUMN amendment_submitted boolean NOT NULL DEFAULT false,
                -- The quorum (Art. 20(3)): half of the Antennae of the network, counted when the voting opens,
                -- and the Antennae that cast at least one vote, counted when it closes.
                ADD COLUMN antennae_total integer CHECK (antennae_total >= 0),
                ADD COLUMN quorum_required integer,
                ADD COLUMN antennae_voted integer CHECK (antennae_voted >= 0),
                ADD COLUMN quorum_reached boolean,
                -- decided: binding for the Agora; to_agora: a new voting on the Agora, for the reason.
                ADD COLUMN outcome text CHECK (outcome IN ('decided', 'to_agora')),
                ADD COLUMN outcome_reason text CHECK (outcome_reason IN ('no_quorum', 'rejected', 'statutes', 'amendment')),
                -- A voting on the Agora can be the new voting of an item that came from Pre-Agora Voting.
                ADD COLUMN follows_voting_id integer REFERENCES votings(id),

                ADD CONSTRAINT pre_agora_majority CHECK (phase <> 'pre_agora' OR majority = 'two_thirds'),
                ADD CONSTRAINT pre_agora_fields CHECK (phase = 'pre_agora' OR (
                    NOT concerns_statutes AND NOT amendment_submitted
                    AND antennae_total IS NULL AND quorum_required IS NULL AND antennae_voted IS NULL
                    AND quorum_reached IS NULL AND outcome IS NULL AND outcome_reason IS NULL
                )),
                ADD CONSTRAINT follows_only_on_agora CHECK (follows_voting_id IS NULL OR phase = 'agora'),
                ADD CONSTRAINT quorum_base_when_opened CHECK (phase <> 'pre_agora' OR status = 'scheduled'
                    OR (antennae_total IS NOT NULL AND quorum_required IS NOT NULL)),
                -- Integer division: (total + 1) / 2 is half of the total, rounded up.
                ADD CONSTRAINT quorum_is_half CHECK (quorum_required IS NULL
                    OR (antennae_total IS NOT NULL AND quorum_required = (antennae_total + 1) / 2)),
                ADD CONSTRAINT quorum_reached_matches CHECK (quorum_reached IS NULL
                    OR (antennae_voted IS NOT NULL AND quorum_required IS NOT NULL AND quorum_reached = (antennae_voted >= quorum_required))),
                -- Art. 20(4): the result is published immediately upon the end of the voting period.
                ADD CONSTRAINT pre_agora_closed CHECK (phase <> 'pre_agora' OR status <> 'closed'
                    OR (published AND quorum_reached IS NOT NULL AND outcome IS NOT NULL)),
                ADD CONSTRAINT outcome_reason_matches CHECK (
                    (outcome IS NULL AND outcome_reason IS NULL)
                    OR (outcome = 'decided' AND outcome_reason IS NULL)
                    OR (outcome = 'to_agora' AND outcome_reason IS NOT NULL)
                );

            CREATE INDEX votings_follows_voting_id ON votings (follows_voting_id);
            ${countDelegateVotes(true)}
        `, { transaction });
    }),
    down: (queryInterface) => queryInterface.sequelize.transaction(async (transaction) => {
        await queryInterface.sequelize.query(`
            ${countDelegateVotes(false)}

            ALTER TABLE votings
                DROP COLUMN follows_voting_id,
                DROP COLUMN outcome_reason,
                DROP COLUMN outcome,
                DROP COLUMN quorum_reached,
                DROP COLUMN antennae_voted,
                DROP COLUMN quorum_required,
                DROP COLUMN antennae_total,
                DROP COLUMN amendment_submitted,
                DROP COLUMN concerns_statutes,
                DROP COLUMN phase;
        `, { transaction });
    })
};
