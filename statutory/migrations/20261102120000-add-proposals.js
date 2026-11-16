// Proposals: a proposal is an item on the agenda of an Agora. The proposer submits it in MyAEGEE
// (Statutes Art. 14(13): members and organs "have the right to present proposals to the Agora"), and the
// JC puts it on the agenda or does not admit it, with a reason (Working Format of the Agora, Art. 8(2)).
// A voting of kind 'proposal' points to the proposal it is about, and the decision of the Agora is stored
// on the proposal, as a checked copy of the voting that decided it.
//
// - proposals: title, the names of the proposers as free text, the part of the CIA it changes, and a link
//   to its text and motivation. The text itself stays outside MyAEGEE.
// - votings.proposal_id: the proposal of a voting, of the same Agora. Its part of the CIA gives the
//   majority, and before the Agora the Statutes flag.
//
// proposal_id is optional for now: a voting of kind 'proposal' without it (a title only) works as before,
// and the rules below apply only to a voting that points to a proposal.
// Locks: opening a voting takes a share lock on its proposal, and a withdrawal updates the proposal,
// so one waits for the other and never both go through.

module.exports = {
    up: (queryInterface) => queryInterface.sequelize.transaction(async (transaction) => {
        await queryInterface.sequelize.query(`
            -- 1. proposals: one row per proposal for one Agora.
            CREATE TABLE proposals (
                id                   serial PRIMARY KEY,
                event_id             integer NOT NULL REFERENCES events(id) ON DELETE CASCADE,
                title                text NOT NULL CHECK (title <> ''),
                -- The names as they appear on the proposal, for example "A. Example on behalf of AEGEE-Atlantis".
                proposers            text NOT NULL CHECK (proposers <> ''),
                -- The part of the CIA it changes, the strictest one if several. It gives the majorities:
                -- statutes (the Statutes or the Convention d'Adhesion): 2/3 (Statutes Art. 36), and always
                -- again on the Agora (WF Agora Art. 20(5)); working_format and other: simple (Art. 17(1)).
                cia_part             text NOT NULL CHECK (cia_part IN ('statutes', 'working_format', 'other')),
                -- Where the text and the motivation are: a link to a document of the proposer, later the booklet.
                text_url             text NOT NULL CONSTRAINT text_url_is_link CHECK (text_url ~ '^https?://'),
                -- The account that submitted it: the proposer, as in OMS.
                created_by           integer NOT NULL,
                -- submitted: the proposer can still change it; on_agenda: the JC admitted it, its text is fixed;
                -- not_admitted: the JC did not admit it, with a reason; withdrawn.
                status               text NOT NULL DEFAULT 'submitted'
                                     CHECK (status IN ('submitted', 'on_agenda', 'not_admitted', 'withdrawn')),
                jc_reason            text,
                -- When the JC put it on the agenda, set by the database and fixed. A withdrawn proposal that was on
                -- the agenda stays visible to every logged-in user.
                on_agenda_at         timestamptz,
                -- What the Agora decided, copied from the voting that decided it, and checked against it.
                decision             text CHECK (decision IN ('accepted', 'rejected')),
                decided_by_voting_id integer,
                decided_at           timestamptz,
                created_at           timestamptz NOT NULL DEFAULT now(),
                updated_at           timestamptz NOT NULL DEFAULT now(),
                UNIQUE (id, event_id),
                CONSTRAINT not_admitted_needs_reason CHECK (status <> 'not_admitted' OR coalesce(jc_reason, '') <> ''),
                CONSTRAINT decision_has_voting CHECK ((decision IS NULL) = (decided_by_voting_id IS NULL)
                    AND (decision IS NULL) = (decided_at IS NULL)),
                CONSTRAINT decision_when_on_agenda CHECK (decision IS NULL OR status = 'on_agenda')
            );

            -- 2. votings: a voting of kind 'proposal' points to its proposal, of the same Agora.
            ALTER TABLE votings
                ADD COLUMN proposal_id integer,
                ADD CONSTRAINT voting_of_proposal_of_same_agora FOREIGN KEY (proposal_id, event_id) REFERENCES proposals (id, event_id),
                ADD CONSTRAINT proposal_only_for_proposals CHECK (proposal_id IS NULL OR kind = 'proposal'),
                -- So that a proposal can point to a voting of its own (decided_by_voting_of_proposal).
                ADD CONSTRAINT voting_id_proposal UNIQUE (id, proposal_id);

            CREATE INDEX votings_proposal_id ON votings (proposal_id);

            ALTER TABLE proposals ADD CONSTRAINT decided_by_voting_of_proposal
                FOREIGN KEY (decided_by_voting_id, id) REFERENCES votings (id, proposal_id);

            -- What a voting decided for its proposal, or NULL when it decided nothing: a closed and published
            -- voting of kind 'proposal'; on the Agora its result, before the Agora 'accepted' when the item
            -- is decided there (WF Agora Art. 20(4)).
            CREATE FUNCTION decision_of_voting(checked_voting integer) RETURNS text AS $$
                SELECT CASE
                    WHEN kind <> 'proposal' OR status <> 'closed' OR NOT published THEN NULL
                    WHEN phase = 'agora' THEN result
                    WHEN outcome = 'decided' THEN 'accepted'
                END
                FROM votings WHERE id = checked_voting
            $$ LANGUAGE sql STABLE;

            -- A proposal: submitted by its proposer; changed only while submitted; on the agenda or not admitted
            -- by the JC; withdrawn only while the Agora does not vote on it; its decision copied from the voting
            -- that decided it, and final.
            CREATE FUNCTION proposal_guard() RETURNS trigger AS $$
            DECLARE
                step text;
            BEGIN
                IF TG_OP = 'INSERT' THEN
                    IF NEW.status <> 'submitted' OR NEW.on_agenda_at IS NOT NULL
                        OR NEW.decision IS NOT NULL OR NEW.decided_by_voting_id IS NOT NULL THEN
                        RAISE EXCEPTION USING ERRCODE = 'check_violation', CONSTRAINT = 'proposal_starts_submitted',
                            MESSAGE = 'A proposal starts as submitted, not on the agenda and without a decision.';
                    END IF;
                    RETURN NEW;
                END IF;

                -- Postgres 10 does not know OLD in an INSERT trigger; everything below is an UPDATE.
                IF NEW.event_id <> OLD.event_id OR NEW.created_by <> OLD.created_by THEN
                    RAISE EXCEPTION USING ERRCODE = 'check_violation', CONSTRAINT = 'proposal_identity_is_fixed',
                        MESSAGE = 'The Agora and the proposer account of a proposal cannot change.';
                END IF;

                -- What the Agora votes on does not change once the JC decided on it.
                IF (NEW.title, NEW.proposers, NEW.cia_part, NEW.text_url) IS DISTINCT FROM (OLD.title, OLD.proposers, OLD.cia_part, OLD.text_url)
                    AND OLD.status <> 'submitted' THEN
                    RAISE EXCEPTION USING ERRCODE = 'check_violation', CONSTRAINT = 'proposal_text_is_fixed',
                        MESSAGE = 'A proposal changes only while it is submitted.';
                END IF;

                IF NEW.on_agenda_at IS DISTINCT FROM OLD.on_agenda_at THEN
                    RAISE EXCEPTION USING ERRCODE = 'check_violation', CONSTRAINT = 'on_agenda_at_is_fixed',
                        MESSAGE = 'When a proposal was put on the agenda, only the database records.';
                END IF;

                IF NEW.status <> OLD.status THEN
                    step := OLD.status || '>' || NEW.status;
                    IF step NOT IN ('submitted>on_agenda', 'submitted>not_admitted', 'submitted>withdrawn', 'on_agenda>withdrawn') THEN
                        RAISE EXCEPTION USING ERRCODE = 'check_violation', CONSTRAINT = 'proposal_status_flow',
                            MESSAGE = format('A proposal cannot go from %s to %s.', OLD.status, NEW.status);
                    END IF;
                    IF NEW.status = 'on_agenda' THEN
                        NEW.on_agenda_at := now();
                    END IF;
                    -- Not while a voting on it is open, and not after the Agora voted on it.
                    IF NEW.status = 'withdrawn' THEN
                        PERFORM 1 FROM votings
                            WHERE proposal_id = NEW.id AND (status = 'open' OR (status = 'closed' AND phase = 'agora'));
                        IF FOUND THEN
                            RAISE EXCEPTION USING ERRCODE = 'check_violation', CONSTRAINT = 'proposal_in_voting',
                                MESSAGE = 'A proposal cannot be withdrawn once the Agora votes on it.';
                        END IF;
                    END IF;
                END IF;

                -- The foreign key decided_by_voting_of_proposal makes sure the voting is a voting of this proposal.
                IF NEW.decision IS DISTINCT FROM OLD.decision OR NEW.decided_by_voting_id IS DISTINCT FROM OLD.decided_by_voting_id THEN
                    IF OLD.decision IS NOT NULL THEN
                        -- The only way back: an amendment submitted at least five days before the Agora sends an item
                        -- that Pre-Agora Voting decided to the Agora after all (WF Agora Art. 20(5)). Once the JC marked
                        -- it on the voting, that voting decides nothing any more, and its decision goes away.
                        IF NEW.decision IS NULL AND NEW.decided_by_voting_id IS NULL AND decision_of_voting(OLD.decided_by_voting_id) IS NULL THEN
                            NEW.decided_at := NULL;
                        ELSE
                            RAISE EXCEPTION USING ERRCODE = 'check_violation', CONSTRAINT = 'decision_is_final',
                                MESSAGE = 'The decision on a proposal cannot change.';
                        END IF;
                    ELSE
                        -- Without a voting, the constraint decision_has_voting refuses it.
                        -- coalesce: a voting that decided nothing gives NULL, and NULL must refuse, not pass.
                        IF NEW.decided_by_voting_id IS NOT NULL
                            AND NOT coalesce(NEW.decision = decision_of_voting(NEW.decided_by_voting_id), false) THEN
                            RAISE EXCEPTION USING ERRCODE = 'check_violation', CONSTRAINT = 'decision_matches_voting',
                                MESSAGE = 'The decision must be the published result of a closed voting on this proposal.';
                        END IF;
                        NEW.decided_at := now();
                    END IF;
                END IF;

                NEW.updated_at := now();
                RETURN NEW;
            END
            $$ LANGUAGE plpgsql;

            -- EXECUTE PROCEDURE instead of EXECUTE FUNCTION, so this also works on Postgres 10.
            CREATE TRIGGER proposal_guard BEFORE INSERT OR UPDATE ON proposals
                FOR EACH ROW EXECUTE PROCEDURE proposal_guard();

            -- A voting that points to a proposal: the proposal is on the agenda and not decided when the voting
            -- opens; the majority and the Statutes flag follow from its part of the CIA.
            -- The share lock on the proposal makes a withdrawal wait for the opening, or the other way round.
            CREATE FUNCTION guard_proposal_voting() RETURNS trigger AS $$
            DECLARE
                p        record;
                expected text;
                opening  boolean;
            BEGIN
                -- A voting without a proposal works as before.
                -- Other kinds with a proposal are refused by the constraint proposal_only_for_proposals.
                IF NEW.proposal_id IS NULL OR NEW.kind <> 'proposal' THEN
                    RETURN NEW;
                END IF;

                -- Postgres 10 does not know OLD in an INSERT trigger, so each use of OLD sits behind TG_OP.
                IF TG_OP = 'INSERT' THEN
                    opening := true;
                ELSE
                    IF NEW.proposal_id IS DISTINCT FROM OLD.proposal_id AND OLD.status <> 'scheduled' THEN
                        RAISE EXCEPTION USING ERRCODE = 'check_violation', CONSTRAINT = 'voting_subject_is_fixed',
                            MESSAGE = 'The proposal of a voting that opened cannot change.';
                    END IF;
                    opening := (NEW.status = 'open' AND OLD.status = 'scheduled') OR NEW.proposal_id IS DISTINCT FROM OLD.proposal_id;
                END IF;

                SELECT status, decision, cia_part INTO p FROM proposals WHERE id = NEW.proposal_id FOR SHARE;

                IF opening THEN
                    IF p.status <> 'on_agenda' THEN
                        RAISE EXCEPTION USING ERRCODE = 'check_violation', CONSTRAINT = 'proposal_not_on_agenda',
                            MESSAGE = 'Only a proposal on the agenda can be voted on.';
                    END IF;
                    IF p.decision IS NOT NULL THEN
                        RAISE EXCEPTION USING ERRCODE = 'check_violation', CONSTRAINT = 'proposal_already_decided',
                            MESSAGE = 'The Agora already decided on this proposal.';
                    END IF;
                END IF;

                IF NEW.phase = 'pre_agora' AND NEW.concerns_statutes <> (p.cia_part = 'statutes') THEN
                    RAISE EXCEPTION USING ERRCODE = 'check_violation', CONSTRAINT = 'statutes_flag_matches_proposal',
                        MESSAGE = 'A Pre-Agora voting concerns the Statutes exactly when its proposal does.';
                END IF;
                expected := CASE WHEN NEW.phase = 'pre_agora' OR p.cia_part = 'statutes' THEN 'two_thirds' ELSE 'simple' END;
                IF NEW.majority IS DISTINCT FROM expected THEN
                    RAISE EXCEPTION USING ERRCODE = 'check_violation', CONSTRAINT = 'majority_matches_proposal',
                        MESSAGE = format('This voting needs the majority %s.', expected);
                END IF;

                RETURN NEW;
            END
            $$ LANGUAGE plpgsql;

            CREATE TRIGGER guard_proposal_voting BEFORE INSERT OR UPDATE ON votings
                FOR EACH ROW EXECUTE PROCEDURE guard_proposal_voting();

            -- The same rule seen from the voting: a voting that decided a proposal keeps deciding the same.
            -- Checked at commit, so that marking an amendment on a Pre-Agora voting and taking the decision
            -- away come in one transaction, in that order.
            CREATE FUNCTION check_decision_of_voting() RETURNS trigger AS $$
            BEGIN
                PERFORM 1 FROM proposals
                    WHERE decided_by_voting_id = NEW.id AND decision IS DISTINCT FROM decision_of_voting(NEW.id);
                IF FOUND THEN
                    RAISE EXCEPTION USING ERRCODE = 'check_violation', CONSTRAINT = 'decision_matches_voting',
                        MESSAGE = 'A voting that decided a proposal cannot change what it decided.';
                END IF;
                RETURN NULL;
            END
            $$ LANGUAGE plpgsql;

            CREATE CONSTRAINT TRIGGER decision_matches_voting AFTER UPDATE ON votings
                DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (NEW.proposal_id IS NOT NULL)
                EXECUTE PROCEDURE check_decision_of_voting();
        `, { transaction });
    }),
    down: (queryInterface) => queryInterface.sequelize.transaction(async (transaction) => {
        await queryInterface.sequelize.query(`
            -- The votings stay: a voting on a proposal becomes a voting with a title only, as before.
            DROP TRIGGER decision_matches_voting ON votings;
            DROP FUNCTION check_decision_of_voting();
            DROP TRIGGER guard_proposal_voting ON votings;
            DROP FUNCTION guard_proposal_voting();

            ALTER TABLE proposals DROP CONSTRAINT decided_by_voting_of_proposal;
            DROP INDEX votings_proposal_id;
            ALTER TABLE votings
                DROP CONSTRAINT voting_id_proposal,
                DROP CONSTRAINT proposal_only_for_proposals,
                DROP CONSTRAINT voting_of_proposal_of_same_agora,
                DROP COLUMN proposal_id;

            DROP TABLE proposals;
            DROP FUNCTION proposal_guard();
            DROP FUNCTION decision_of_voting(integer);
        `, { transaction });
    })
};
