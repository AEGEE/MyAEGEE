// Elections: an election is a voting of kind 'election' for a position. The snapshot, the division
// rule and the lifecycle of a voting stay as they are. What is new is the secret ballot:
// "Secret votes are carried out for elections" (Statutes Art. 14(12)), and each Antenna receives
// "as many ballots as they have votes" (Working Format of the Agora, Art. 11(3)).
//
// - voting_options: the candidates on the ballot of one election, fixed when it opens.
// - voting_ballots: one row per ballot (one vote). No person, no body, no time, no sequence number.
// - voting_ballot_marks: one row per candidate marked on a ballot. A blank ballot has no marks.
// - voting_delegate_votes.ballots_cast: how many ballots the delegate cast, never what is on them.
//
// The database keeps the ballot box in step with the delegates (ballots_match_votes), and closing an
// election writes all ballots again in random order (shuffle_ballot_box), so that neither the
// physical order nor the transaction ID of a ballot tells which delegate cast it.

// The trigger function of migrations/20261030120000-add-pre-agora-voting.js; up adds the ballots
// of an election, down restores it.
const countDelegateVotes = (withBallots) => {
    const total = (row) => `${row}.in_favour + ${row}.against + ${row}.abstention${withBallots ? ` + ${row}.ballots_cast` : ''}`;

    return `
            CREATE OR REPLACE FUNCTION count_delegate_votes() RETURNS trigger AS $$
            DECLARE
                old_total     integer;
                new_total     integer;
                voting_status    text;
                voting_closes_at timestamptz;
                voting_phase     text;${withBallots ? `
                voting_kind      text;` : ''}
            BEGIN
                -- Rows are created empty when the voting opens; votes only come in through an UPDATE.
                IF TG_OP = 'INSERT' THEN
                    IF ${total('NEW')} <> 0 OR NEW.submitted_at IS NOT NULL THEN
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
                SELECT status, closes_at, phase${withBallots ? ', kind' : ''} INTO voting_status, voting_closes_at, voting_phase${withBallots ? ', voting_kind' : ''} FROM votings WHERE id = NEW.voting_id FOR SHARE;
                IF voting_status IS DISTINCT FROM 'open' OR now() >= voting_closes_at THEN
                    RAISE EXCEPTION USING ERRCODE = 'check_violation', CONSTRAINT = 'voting_not_open',
                        MESSAGE = 'This voting is not open.';
                END IF;
${withBallots ? `
                -- An election stores no choice on the row of the delegate, only the number of ballots;
                -- the ballots themselves go into the ballot box. Other votings count the choices here.
                IF (voting_kind = 'election' AND NEW.in_favour + NEW.against + NEW.abstention <> 0)
                    OR (voting_kind <> 'election' AND NEW.ballots_cast <> 0) THEN
                    RAISE EXCEPTION USING ERRCODE = 'check_violation', CONSTRAINT = 'vote_form_matches_kind',
                        MESSAGE = 'An election counts ballots; other votings count in favour, against and abstention.';
                END IF;
` : ''}
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
                END IF;

                old_total := ${total('OLD')};
                new_total := ${total('NEW')};
                NEW.submitted_at := now();

                UPDATE voting_body_allotments
                    SET votes_cast = votes_cast + new_total - old_total,
                        delegates_above_min = delegates_above_min
                            + (new_total > min_votes)::integer - (old_total > min_votes)::integer
                    WHERE voting_id = NEW.voting_id AND body_id = NEW.body_id;

                RETURN NEW;
            END
            $$ LANGUAGE plpgsql;`;
};

module.exports = {
    up: (queryInterface) => queryInterface.sequelize.transaction(async (transaction) => {
        await queryInterface.sequelize.query(`
            -- 1. votings: an election is a voting of kind 'election' for a position.
            ALTER TABLE votings DROP CONSTRAINT votings_kind_check;
            ALTER TABLE votings ADD CONSTRAINT votings_kind_check CHECK (kind IN ('proposal', 'rollcall', 'election'));
            ALTER TABLE votings ALTER COLUMN majority DROP NOT NULL;
            ALTER TABLE votings
                ADD COLUMN position_id   integer REFERENCES positions(id),
                -- The people that this election elects, and so the most candidates marked on one ballot
                -- (Working Format of the Agora, Art. 13). By default the places of the position.
                ADD COLUMN seats         integer CHECK (seats >= 1),
                -- The threshold: absolute_majority (Statutes Art. 17(2)), half_of_votes_cast
                -- (Working Format of the Agora, Art. 12(1)), commission (Art. 14(1)).
                ADD COLUMN election_rule text CHECK (election_rule IN ('absolute_majority', 'half_of_votes_cast', 'commission')),
                -- An election has a position, seats and an election rule, and no majority; other votings the other way round.
                ADD CONSTRAINT election_fields CHECK (
                    (kind = 'election') = (position_id IS NOT NULL)
                    AND (kind = 'election') = (seats IS NOT NULL)
                    AND (kind = 'election') = (election_rule IS NOT NULL)
                    AND (kind = 'election') = (majority IS NULL)
                ),
                -- The result of an election is per candidate (voting_options.outcome), not accepted or rejected.
                ADD CONSTRAINT election_has_no_result CHECK (kind <> 'election' OR result IS NULL),
                -- "Secret ballots and elections are excluded from pre-Agora voting" (Art. 20(6)).
                ADD CONSTRAINT elections_on_the_agora CHECK (kind <> 'election' OR phase = 'agora');

            CREATE INDEX votings_position_id ON votings (position_id);

            -- 2. voting_options: the candidates on the ballot of one election. The JC chooses them
            -- while the election is scheduled; the opening copies the names to label, and closing
            -- sets the outcome. (voting_id, id) is unique, so that a mark can point to an option of its own election.
            CREATE TABLE voting_options (
                id           serial PRIMARY KEY,
                voting_id    integer NOT NULL REFERENCES votings(id) ON DELETE CASCADE,
                candidate_id integer NOT NULL REFERENCES candidates(id),
                label        text NOT NULL,
                ballot_order integer NOT NULL CHECK (ballot_order >= 1),
                outcome      text CHECK (outcome IN ('elected', 'not_elected', 'tie')),
                UNIQUE (voting_id, candidate_id),
                UNIQUE (voting_id, ballot_order) DEFERRABLE INITIALLY DEFERRED,
                UNIQUE (voting_id, id)
            );

            CREATE FUNCTION guard_voting_options() RETURNS trigger AS $$
            DECLARE
                voting_status text;
                voting_kind   text;
            BEGIN
                -- Postgres 10 has no NEW in a DELETE trigger, so the operation decides which row to read.
                IF TG_OP = 'DELETE' THEN
                    SELECT status INTO voting_status FROM votings WHERE id = OLD.voting_id FOR SHARE;
                    -- Not found: the voting itself is being deleted (cascade).
                    IF FOUND AND voting_status <> 'scheduled' THEN
                        RAISE EXCEPTION USING ERRCODE = 'check_violation', CONSTRAINT = 'ballot_is_fixed',
                            MESSAGE = 'The candidates on the ballot cannot change once the election opened.';
                    END IF;
                    RETURN OLD;
                END IF;

                IF TG_OP = 'UPDATE' AND NEW.voting_id = OLD.voting_id AND NEW.candidate_id = OLD.candidate_id
                    AND NEW.label = OLD.label AND NEW.ballot_order = OLD.ballot_order THEN
                    RETURN NEW; -- only the outcome changes, when the election closes
                END IF;

                SELECT status, kind INTO voting_status, voting_kind FROM votings WHERE id = NEW.voting_id FOR SHARE;
                IF voting_kind IS DISTINCT FROM 'election' THEN
                    RAISE EXCEPTION USING ERRCODE = 'check_violation', CONSTRAINT = 'options_only_for_elections',
                        MESSAGE = 'Only an election has candidates on the ballot.';
                END IF;
                -- The opening copies the labels in its own transaction, before the status changes.
                IF voting_status <> 'scheduled' THEN
                    RAISE EXCEPTION USING ERRCODE = 'check_violation', CONSTRAINT = 'ballot_is_fixed',
                        MESSAGE = 'The candidates on the ballot cannot change once the election opened.';
                END IF;
                PERFORM 1 FROM candidates c JOIN votings v ON v.position_id = c.position_id
                    WHERE c.id = NEW.candidate_id AND v.id = NEW.voting_id;
                IF NOT FOUND THEN
                    RAISE EXCEPTION USING ERRCODE = 'check_violation', CONSTRAINT = 'candidate_of_position',
                        MESSAGE = 'The candidate does not stand for the position of this election.';
                END IF;
                RETURN NEW;
            END
            $$ LANGUAGE plpgsql;

            -- EXECUTE PROCEDURE instead of EXECUTE FUNCTION, so this also works on Postgres 10.
            CREATE TRIGGER guard_voting_options BEFORE INSERT OR UPDATE OR DELETE ON voting_options
                FOR EACH ROW EXECUTE PROCEDURE guard_voting_options();

            -- The same rules seen from the voting: with candidates on its ballot, an election keeps
            -- its kind and its position. To change them, the ballot goes first.
            CREATE FUNCTION guard_election_ballot() RETURNS trigger AS $$
            BEGIN
                IF (NEW.kind IS DISTINCT FROM OLD.kind OR NEW.position_id IS DISTINCT FROM OLD.position_id)
                    AND EXISTS (SELECT 1 FROM voting_options WHERE voting_id = NEW.id) THEN
                    IF NEW.kind IS DISTINCT FROM 'election' THEN
                        RAISE EXCEPTION USING ERRCODE = 'check_violation', CONSTRAINT = 'options_only_for_elections',
                            MESSAGE = 'Only an election has candidates on the ballot.';
                    END IF;
                    RAISE EXCEPTION USING ERRCODE = 'check_violation', CONSTRAINT = 'candidate_of_position',
                        MESSAGE = 'The candidates on the ballot stand for the position of this election.';
                END IF;
                RETURN NEW;
            END
            $$ LANGUAGE plpgsql;

            CREATE TRIGGER guard_election_ballot BEFORE UPDATE OF kind, position_id ON votings
                FOR EACH ROW EXECUTE PROCEDURE guard_election_ballot();

            -- 3. voting_ballots: one row per ballot. The ID is random (made by the API), so it tells nothing.
            CREATE TABLE voting_ballots (
                id        uuid PRIMARY KEY,
                voting_id integer NOT NULL REFERENCES votings(id) ON DELETE CASCADE,
                UNIQUE (voting_id, id)
            );

            -- 4. voting_ballot_marks: the candidates marked on a ballot.
            CREATE TABLE voting_ballot_marks (
                voting_id integer NOT NULL,
                ballot_id uuid NOT NULL,
                option_id integer NOT NULL,
                -- "A candidate cannot receive more than one vote on the same ballot" (Art. 11(3)).
                CONSTRAINT one_mark_per_candidate PRIMARY KEY (ballot_id, option_id),
                CONSTRAINT mark_on_ballot_of_voting FOREIGN KEY (voting_id, ballot_id)
                    REFERENCES voting_ballots (voting_id, id) ON DELETE CASCADE,
                -- A candidate leaves the ballot only before the opening (no marks yet) or with the whole election.
                CONSTRAINT mark_for_candidate_of_voting FOREIGN KEY (voting_id, option_id)
                    REFERENCES voting_options (voting_id, id) ON DELETE CASCADE
            );

            CREATE INDEX voting_ballot_marks_option ON voting_ballot_marks (voting_id, option_id);

            -- Ballots and marks only come in while the election is open, and never change afterwards.
            -- pg_trigger_depth() > 1 means the write comes from a trigger: the shuffle at closing, or a cascade.
            CREATE FUNCTION guard_ballot_box() RETURNS trigger AS $$
            DECLARE
                voting_status    text;
                voting_kind      text;
                voting_closes_at timestamptz;
            BEGIN
                IF pg_trigger_depth() > 1 THEN
                    IF TG_OP = 'DELETE' THEN
                        RETURN OLD;
                    END IF;
                    RETURN NEW;
                END IF;
                IF TG_OP <> 'INSERT' THEN
                    RAISE EXCEPTION USING ERRCODE = 'check_violation', CONSTRAINT = 'ballots_are_final',
                        MESSAGE = 'A ballot cannot be changed or removed.';
                END IF;
                -- The share lock makes closing the election wait until this ballot is stored.
                SELECT status, kind, closes_at INTO voting_status, voting_kind, voting_closes_at
                    FROM votings WHERE id = NEW.voting_id FOR SHARE;
                IF voting_kind IS DISTINCT FROM 'election' OR voting_status IS DISTINCT FROM 'open' OR now() >= voting_closes_at THEN
                    RAISE EXCEPTION USING ERRCODE = 'check_violation', CONSTRAINT = 'voting_not_open',
                        MESSAGE = 'This voting is not open.';
                END IF;
                RETURN NEW;
            END
            $$ LANGUAGE plpgsql;

            CREATE TRIGGER guard_ballot_box BEFORE INSERT OR UPDATE OR DELETE ON voting_ballots
                FOR EACH ROW EXECUTE PROCEDURE guard_ballot_box();
            CREATE TRIGGER guard_ballot_box BEFORE INSERT OR UPDATE OR DELETE ON voting_ballot_marks
                FOR EACH ROW EXECUTE PROCEDURE guard_ballot_box();

            -- No more candidates marked than there are seats (Art. 13(2); Voting Ballots Art. 2).
            CREATE FUNCTION check_marks_within_seats() RETURNS trigger AS $$
            DECLARE
                marks        integer;
                voting_seats integer;
            BEGIN
                SELECT seats INTO voting_seats FROM votings WHERE id = NEW.voting_id;
                SELECT count(*) INTO marks FROM voting_ballot_marks WHERE ballot_id = NEW.ballot_id;
                IF marks > voting_seats THEN
                    RAISE EXCEPTION USING ERRCODE = 'check_violation', CONSTRAINT = 'marks_within_seats',
                        MESSAGE = 'A ballot has more candidates marked than there are seats.';
                END IF;
                RETURN NULL;
            END
            $$ LANGUAGE plpgsql;

            CREATE TRIGGER marks_within_seats AFTER INSERT ON voting_ballot_marks
                FOR EACH ROW EXECUTE PROCEDURE check_marks_within_seats();

            -- 5. voting_delegate_votes: in an election, the row of the delegate counts the ballots.
            -- The division rule of the body counts them as votes.
            ALTER TABLE voting_delegate_votes
                ADD COLUMN ballots_cast integer NOT NULL DEFAULT 0 CHECK (ballots_cast >= 0),
                DROP CONSTRAINT delegate_vote_limit,
                ADD CONSTRAINT delegate_vote_limit CHECK (in_favour + against + abstention + ballots_cast <= max_votes);
            ${countDelegateVotes(true)}

            -- 6. The ballot box always holds exactly as many ballots as the delegates counted. Checked at
            -- commit, so the counter of the delegate and the ballots must come in one transaction.
            CREATE FUNCTION check_ballots_match_votes() RETURNS trigger AS $$
            DECLARE
                checked_voting integer;
                ballots        bigint;
                counted        bigint;
            BEGIN
                IF TG_OP = 'DELETE' THEN
                    checked_voting := OLD.voting_id;
                ELSE
                    checked_voting := NEW.voting_id;
                END IF;
                -- One statement, so both numbers come from the same snapshot of the database.
                SELECT (SELECT count(*) FROM voting_ballots WHERE voting_id = checked_voting),
                       (SELECT COALESCE(sum(ballots_cast), 0) FROM voting_delegate_votes WHERE voting_id = checked_voting)
                    INTO ballots, counted;
                IF ballots <> counted THEN
                    RAISE EXCEPTION USING ERRCODE = 'check_violation', CONSTRAINT = 'ballots_match_votes',
                        MESSAGE = format('The ballot box has %s ballots, but the delegates cast %s.', ballots, counted);
                END IF;
                RETURN NULL;
            END
            $$ LANGUAGE plpgsql;

            CREATE CONSTRAINT TRIGGER ballots_match_votes AFTER INSERT OR DELETE ON voting_ballots
                DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE PROCEDURE check_ballots_match_votes();
            CREATE CONSTRAINT TRIGGER ballots_match_votes AFTER UPDATE OF ballots_cast ON voting_delegate_votes
                DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE PROCEDURE check_ballots_match_votes();

            -- 7. Closing an election shuffles the ballot box: the closing transaction writes all ballots
            -- and marks again, in random order. Before, each ballot has the transaction ID (xmin) of the
            -- vote of its delegate and sits next to the other ballots of that vote, also in a backup.
            -- After, all ballots have the transaction ID of the closing, in an order that tells nothing.
            CREATE FUNCTION shuffle_ballot_box() RETURNS trigger AS $$
            DECLARE
                ballot_ids   uuid[];
                mark_ballots uuid[];
                mark_options integer[];
            BEGIN
                SELECT array_agg(id ORDER BY random()) INTO ballot_ids FROM voting_ballots WHERE voting_id = NEW.id;
                SELECT array_agg(ballot_id ORDER BY r), array_agg(option_id ORDER BY r) INTO mark_ballots, mark_options
                    FROM (SELECT ballot_id, option_id, random() AS r FROM voting_ballot_marks WHERE voting_id = NEW.id) AS m;
                DELETE FROM voting_ballots WHERE voting_id = NEW.id; -- the marks go with them (cascade)
                INSERT INTO voting_ballots (id, voting_id)
                    SELECT b, NEW.id FROM unnest(ballot_ids) WITH ORDINALITY AS t (b, i) ORDER BY i;
                INSERT INTO voting_ballot_marks (voting_id, ballot_id, option_id)
                    SELECT NEW.id, b, o FROM unnest(mark_ballots, mark_options) WITH ORDINALITY AS t (b, o, i) ORDER BY i;
                RETURN NULL;
            END
            $$ LANGUAGE plpgsql;

            CREATE TRIGGER shuffle_ballot_box AFTER UPDATE OF status ON votings
                FOR EACH ROW WHEN (OLD.status = 'open' AND NEW.status = 'closed' AND NEW.kind = 'election')
                EXECUTE PROCEDURE shuffle_ballot_box();
        `, { transaction });
    }),
    down: (queryInterface) => queryInterface.sequelize.transaction(async (transaction) => {
        await queryInterface.sequelize.query(`
            -- The checks at commit go first: the elections below are deleted with their ballots, and a
            -- table with checks still to run at commit cannot be dropped in the same transaction.
            DROP TRIGGER ballots_match_votes ON voting_ballots;
            DROP TRIGGER ballots_match_votes ON voting_delegate_votes;
            DROP FUNCTION check_ballots_match_votes();

            -- An election cannot exist without its ballot, so the elections go with the tables below.
            DELETE FROM votings WHERE kind = 'election';

            DROP TRIGGER shuffle_ballot_box ON votings;
            DROP FUNCTION shuffle_ballot_box();
            DROP TRIGGER guard_election_ballot ON votings;
            DROP FUNCTION guard_election_ballot();
            DROP TABLE voting_ballot_marks;
            DROP TABLE voting_ballots;
            DROP FUNCTION check_marks_within_seats();
            DROP FUNCTION guard_ballot_box();
            DROP TABLE voting_options;
            DROP FUNCTION guard_voting_options();
            ${countDelegateVotes(false)}

            ALTER TABLE voting_delegate_votes
                DROP CONSTRAINT delegate_vote_limit,
                DROP COLUMN ballots_cast,
                ADD CONSTRAINT delegate_vote_limit CHECK (in_favour + against + abstention <= max_votes);

            DROP INDEX votings_position_id;
            ALTER TABLE votings
                DROP CONSTRAINT elections_on_the_agora,
                DROP CONSTRAINT election_has_no_result,
                DROP CONSTRAINT election_fields,
                DROP COLUMN election_rule,
                DROP COLUMN seats,
                DROP COLUMN position_id;
            ALTER TABLE votings ALTER COLUMN majority SET NOT NULL;
            ALTER TABLE votings DROP CONSTRAINT votings_kind_check;
            ALTER TABLE votings ADD CONSTRAINT votings_kind_check CHECK (kind IN ('proposal', 'rollcall'));
        `, { transaction });
    })
};
