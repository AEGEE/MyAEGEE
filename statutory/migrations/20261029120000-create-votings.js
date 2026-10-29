module.exports = {
    up: (queryInterface) => queryInterface.sequelize.transaction(async (transaction) => {
        await queryInterface.sequelize.query(`
            CREATE TABLE votings (
                id          serial PRIMARY KEY,
                event_id    integer NOT NULL REFERENCES events(id) ON DELETE CASCADE,
                kind        text NOT NULL CHECK (kind IN ('proposal', 'rollcall')),
                title       text NOT NULL,
                description text,
                majority    text NOT NULL CHECK (majority IN ('simple', 'absolute', 'two_thirds')),
                status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed')),
                result      text CHECK (result IN ('accepted', 'rejected')),
                opened_at   timestamptz,
                opened_by   integer,
                closed_at   timestamptz,
                closed_by   integer,
                created_at  timestamptz NOT NULL,
                updated_at  timestamptz NOT NULL
            );

            CREATE INDEX votings_event_id ON votings (event_id);

            CREATE TABLE voting_body_allotments (
                voting_id           integer NOT NULL REFERENCES votings(id) ON DELETE CASCADE,
                body_id             integer NOT NULL,
                votes_total         integer NOT NULL CHECK (votes_total >= 0),
                min_votes           integer NOT NULL CHECK (min_votes >= 0), -- floor(votes_total / delegates)
                extra_votes         integer NOT NULL CHECK (extra_votes >= 0), -- votes_total mod delegates
                votes_cast          integer NOT NULL DEFAULT 0,
                delegates_above_min integer NOT NULL DEFAULT 0,
                PRIMARY KEY (voting_id, body_id),
                -- Rule 1: all delegates of a body together never cast more votes than the body has.
                CONSTRAINT body_vote_limit CHECK (votes_cast <= votes_total),
                -- Rule 3: no more delegates cast more than the minimum than there are extra votes.
                CONSTRAINT extra_vote_limit CHECK (delegates_above_min <= extra_votes)
            );

            CREATE TABLE voting_delegate_votes (
                voting_id      integer NOT NULL,
                application_id integer NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
                user_id        integer NOT NULL,
                body_id        integer NOT NULL,
                max_votes      integer NOT NULL CHECK (max_votes >= 0), -- min_votes + 1 if extra_votes > 0, else min_votes
                in_favour      integer NOT NULL DEFAULT 0 CHECK (in_favour >= 0),
                against        integer NOT NULL DEFAULT 0 CHECK (against >= 0),
                abstention     integer NOT NULL DEFAULT 0 CHECK (abstention >= 0),
                submitted_at   timestamptz,
                PRIMARY KEY (voting_id, application_id),
                UNIQUE (voting_id, user_id),
                FOREIGN KEY (voting_id, body_id) REFERENCES voting_body_allotments (voting_id, body_id) ON DELETE CASCADE,
                -- Rule 2: no delegate casts more than the minimum plus one (plus one only if there are extra votes).
                CONSTRAINT delegate_vote_limit CHECK (in_favour + against + abstention <= max_votes)
            );

            -- Keeps the counters of the body in step with the votes of its delegates, so that
            -- the constraints above see every vote. The UPDATE on the body row locks that row,
            -- so the votes of one body are stored one after another; votes of other bodies do not wait.
            -- Each refusal names a constraint, so the API can tell the delegate what went wrong.
            CREATE FUNCTION count_delegate_votes() RETURNS trigger AS $$
            DECLARE
                old_total     integer;
                new_total     integer;
                voting_status text;
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
                SELECT status INTO voting_status FROM votings WHERE id = NEW.voting_id FOR SHARE;
                IF voting_status IS DISTINCT FROM 'open' THEN
                    RAISE EXCEPTION USING ERRCODE = 'check_violation', CONSTRAINT = 'voting_not_open',
                        MESSAGE = 'This voting is not open.';
                END IF;

                -- A delegate who departed or was cancelled after the voting opened cannot vote.
                -- The votes of this delegate do not go to the other delegates of the body.
                PERFORM 1 FROM applications
                    WHERE id = NEW.application_id AND participant_type = 'delegate'
                    AND confirmed AND registered AND NOT departed AND NOT cancelled;
                IF NOT FOUND THEN
                    RAISE EXCEPTION USING ERRCODE = 'check_violation', CONSTRAINT = 'delegate_not_present',
                        MESSAGE = 'This delegate is not present any more.';
                END IF;

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
            $$ LANGUAGE plpgsql;

            -- EXECUTE PROCEDURE instead of EXECUTE FUNCTION, so this also works on Postgres 10.
            CREATE TRIGGER count_delegate_votes BEFORE INSERT OR UPDATE ON voting_delegate_votes
                FOR EACH ROW EXECUTE PROCEDURE count_delegate_votes();

            -- The CHECK constraints on the body row are only as good as its counters. So only the
            -- trigger count_delegate_votes may change them: a body row starts with counters at 0, and a
            -- direct UPDATE cannot reset them to make room for more votes than the body has.
            -- pg_trigger_depth() > 1 means this UPDATE comes from a trigger on voting_delegate_votes.
            CREATE FUNCTION guard_body_vote_counters() RETURNS trigger AS $$
            BEGIN
                IF TG_OP = 'INSERT' THEN
                    IF NEW.votes_cast <> 0 OR NEW.delegates_above_min <> 0 THEN
                        RAISE EXCEPTION USING ERRCODE = 'check_violation', CONSTRAINT = 'counters_are_derived',
                            MESSAGE = 'A body row must be created with its vote counters at 0.';
                    END IF;
                    RETURN NEW;
                END IF;

                IF (NEW.votes_cast <> OLD.votes_cast OR NEW.delegates_above_min <> OLD.delegates_above_min)
                    AND pg_trigger_depth() <= 1 THEN
                    RAISE EXCEPTION USING ERRCODE = 'check_violation', CONSTRAINT = 'counters_are_derived',
                        MESSAGE = 'The vote counters of a body change only through the votes of its delegates.';
                END IF;
                RETURN NEW;
            END
            $$ LANGUAGE plpgsql;

            CREATE TRIGGER guard_body_vote_counters BEFORE INSERT OR UPDATE ON voting_body_allotments
                FOR EACH ROW EXECUTE PROCEDURE guard_body_vote_counters();
        `, { transaction });
    }),
    down: (queryInterface) => queryInterface.sequelize.transaction(async (transaction) => {
        await queryInterface.sequelize.query(`
            DROP TABLE voting_delegate_votes;
            DROP FUNCTION count_delegate_votes();
            DROP TABLE voting_body_allotments;
            DROP FUNCTION guard_body_vote_counters();
            DROP TABLE votings;
        `, { transaction });
    })
};
