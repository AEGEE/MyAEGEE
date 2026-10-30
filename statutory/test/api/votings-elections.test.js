const lodash = require('lodash');
const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const cron = require('../../lib/cron');
const logger = require('../../lib/logger');
const { VotesPerAntenna, VotingDelegateVote, VotingOption } = require('../../models');

// An election is a voting of kind 'election' for a position. A delegate casts one secret ballot
// per vote, with at most as many candidates marked as there are seats. The system counts the votes
// per candidate and gives each candidate an outcome; the JC checks it and publishes it.
describe('Votings: elections', () => {
    let event;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    // Body 34 has 5 votes and 3 delegates (users 10, 11 and 12): minimum 1, 2 extra votes.
    beforeEach(async () => {
        mock.mockAll({ core: { userFromToken: true } });
        event = await generator.createEvent({ type: 'agora', applications: [] });
        await VotesPerAntenna.create({ event_id: event.id, body_id: 34, votes: 5 });
        for (const userId of [10, 11, 12]) {
            await generator.createPresentDelegate({ user_id: userId, body_id: 34 }, event);
        }
    });

    afterEach(async () => {
        jest.restoreAllMocks();
        mock.cleanAll();
        cron.clearAll();
        await generator.clearAll();
    });

    // The JC (all permissions in the mock of core).
    const call = (method, path, body) => request({
        path: '/events/' + event.id + '/votings' + path,
        method,
        headers: { 'X-Auth-Token': 'blablabla' },
        body
    });

    const myVote = (method, voting, userId, body) => request({
        path: '/events/' + event.id + '/votings/' + voting.id + '/my-vote',
        method,
        headers: { 'X-Auth-Token': 'user-' + userId },
        body
    });

    const createPosition = async (candidates, options = {}) => {
        const position = await generator.createPosition({ places: 2, ...options }, event);
        const created = [];
        for (const [lastName, status] of candidates) {
            created.push(await generator.createCandidate({ first_name: 'Candidate', last_name: lastName, status }, position));
        }
        return { position, candidates: created };
    };

    const electionFields = (fields) => ({
        kind: 'election',
        title: 'Election of the Comite Directeur',
        opens_at: moment().add(1, 'day').toISOString(),
        closes_at: moment().add(1, 'day').add(1, 'hour').toISOString(),
        election_rule: 'absolute_majority',
        ...fields
    });

    // Opens a second ago: the first request that reads the election opens it.
    const openElection = async (options = {}, settings = {}) => {
        const election = await generator.createElection({
            opens_at: new Date(Date.now() - 1000),
            closes_at: new Date(Date.now() + 3600 * 1000),
            ...options
        }, event, settings);
        const res = await call('GET', '/' + election.voting.id);
        expect(res.statusCode).toEqual(200);
        expect(res.body.data.status).toEqual('open');
        return election;
    };

    describe('creating', () => {
        test('should put all approved candidates on the ballot, by last name, and take the seats of the position', async () => {
            const { position, candidates } = await createPosition([['Zeta', 'approved'], ['Alpha', 'approved'], ['Mu', 'pending'], ['Beta', 'rejected']]);

            const res = await call('POST', '', electionFields({ position_id: position.id }));

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({
                kind: 'election',
                position_id: position.id,
                seats: 2,
                election_rule: 'absolute_majority',
                majority: null,
                phase: 'agora',
                status: 'scheduled'
            });
            expect(res.body.data.options.map((option) => lodash.pick(option, ['candidate_id', 'label', 'ballot_order', 'outcome']))).toEqual([
                { candidate_id: candidates[1].id, label: 'Candidate Alpha', ballot_order: 1, outcome: null },
                { candidate_id: candidates[0].id, label: 'Candidate Zeta', ballot_order: 2, outcome: null }
            ]);
            expect(res.body.data.ballot_problem).toEqual(null);
        });

        test('should put the candidates that the JC chose on the ballot, in that order, with the seats of the JC', async () => {
            const { position, candidates } = await createPosition([['Alpha', 'approved'], ['Beta', 'approved'], ['Gamma', 'approved']]);

            const res = await call('POST', '', electionFields({
                position_id: position.id,
                seats: 1,
                candidates: [candidates[2].id, candidates[0].id]
            }));

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.seats).toEqual(1);
            expect(res.body.data.options.map((option) => [option.candidate_id, option.ballot_order])).toEqual([
                [candidates[2].id, 1],
                [candidates[0].id, 2]
            ]);
        });

        test.each([
            ['a majority', { majority: 'simple' }, 'majority'],
            ['Pre-Agora Voting', { phase: 'pre_agora' }, 'phase'],
            ['an unknown election rule', { election_rule: 'most_votes' }, 'election_rule'],
            ['no election rule', { election_rule: undefined }, 'election_rule'],
            ['0 seats', { seats: 0 }, 'seats']
        ])('should refuse an election with %s', async (name, fields, field) => {
            const { position } = await createPosition([['Alpha', 'approved']]);

            const res = await call('POST', '', electionFields({ position_id: position.id, ...fields }));

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty(field);
            // Only the field that is wrong: Pre-Agora Voting does not add a majority to an election.
            expect(Object.keys(res.body.errors)).toEqual([field]);
        });

        test('should refuse a proposal with the fields of an election', async () => {
            const { position } = await createPosition([['Alpha', 'approved']]);

            const res = await call('POST', '', generator.generateVoting({ kind: 'proposal', position_id: position.id, seats: 1 }));

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('position_id');
            expect(res.body.errors).toHaveProperty('seats');
        });

        test('should refuse a position of another event, or a deleted position', async () => {
            const otherEvent = await generator.createEvent({ type: 'agora', applications: [] });
            const other = await generator.createPosition({}, otherEvent);
            const deleted = await createPosition([['Alpha', 'approved']], { deleted: true });

            for (const positionId of [other.id, deleted.position.id, 999999]) {
                const res = await call('POST', '', electionFields({ position_id: positionId }));
                expect(res.statusCode).toEqual(422);
                expect(res.body.message).toEqual('The position should be a position of this Agora.');
            }
        });

        test('should refuse a ballot without candidates', async () => {
            const { position } = await createPosition([['Alpha', 'pending']]);

            const res = await call('POST', '', electionFields({ position_id: position.id }));

            expect(res.statusCode).toEqual(422);
            expect(res.body.message).toEqual('An election needs at least one approved candidate on the ballot.');
        });

        test('should refuse a candidate who is not approved, or who stands for another position', async () => {
            const { position, candidates } = await createPosition([['Alpha', 'approved'], ['Beta', 'pending']]);
            const other = await createPosition([['Gamma', 'approved']]);

            const notApproved = await call('POST', '', electionFields({ position_id: position.id, candidates: [candidates[0].id, candidates[1].id] }));
            expect(notApproved.statusCode).toEqual(422);
            expect(notApproved.body.message).toEqual('Only approved candidates for this position can be on the ballot.');

            const otherPosition = await call('POST', '', electionFields({ position_id: position.id, candidates: [other.candidates[0].id] }));
            expect(otherPosition.statusCode).toEqual(422);

            const twice = await call('POST', '', electionFields({ position_id: position.id, candidates: [candidates[0].id, candidates[0].id] }));
            expect(twice.statusCode).toEqual(422);
            expect(twice.body.message).toEqual('The field "candidates" should be a list of different candidate IDs.');
        });
    });

    describe('editing', () => {
        test('should replace the ballot when the JC gives other candidates', async () => {
            const { position, candidates } = await createPosition([['Alpha', 'approved'], ['Beta', 'approved']]);
            const created = await call('POST', '', electionFields({ position_id: position.id }));

            const res = await call('PUT', '/' + created.body.data.id, { candidates: [candidates[1].id] });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.options.map((option) => option.candidate_id)).toEqual([candidates[1].id]);
            expect(await VotingOption.count({ where: { voting_id: created.body.data.id } })).toEqual(1);
        });

        test('should put the approved candidates of the new position on the ballot when the position changes', async () => {
            const first = await createPosition([['Alpha', 'approved']]);
            const second = await createPosition([['Beta', 'approved'], ['Gamma', 'approved']], { places: 3 });
            const created = await call('POST', '', electionFields({ position_id: first.position.id }));

            const res = await call('PUT', '/' + created.body.data.id, { position_id: second.position.id, seats: 3 });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.position_id).toEqual(second.position.id);
            expect(res.body.data.options.map((option) => option.candidate_id)).toEqual(second.candidates.map((candidate) => candidate.id));
        });

        test('should refuse to change an election into another kind of voting, or the other way round', async () => {
            const { position } = await createPosition([['Alpha', 'approved']]);
            const created = await call('POST', '', electionFields({ position_id: position.id }));
            const proposal = await generator.createVoting({ kind: 'proposal' }, event);

            const toProposal = await call('PUT', '/' + created.body.data.id, { kind: 'proposal', majority: 'simple' });
            expect(toProposal.statusCode).toEqual(422);
            expect(toProposal.body.message).toEqual('An election cannot become another kind of voting, or the other way round: delete it and create a new one.');

            const toElection = await call('PUT', '/' + proposal.id, { kind: 'election', position_id: position.id, seats: 1, election_rule: 'commission' });
            expect(toElection.statusCode).toEqual(422);
        });
    });

    describe('opening', () => {
        test('should copy the current names of the candidates to the ballot', async () => {
            const election = await generator.createElection({ opens_at: new Date(Date.now() - 1000) }, event);
            await election.candidates[0].update({ last_name: 'Renamed' });

            const res = await call('GET', '/' + election.voting.id);

            expect(res.body.data.status).toEqual('open');
            expect(res.body.data.options.map((option) => option.label)).toEqual(['Candidate Renamed', 'Candidate B', 'Candidate C']);
        });

        test('should not open while a candidature on the ballot is not approved any more, and let the JC fix the ballot', async () => {
            const election = await generator.createElection({ opens_at: new Date(Date.now() - 1000) }, event);
            await election.candidates[1].update({ status: 'rejected' });

            const blocked = await call('GET', '/' + election.voting.id);
            expect(blocked.statusCode).toEqual(200);
            expect(blocked.body.data.status).toEqual('scheduled');
            expect(blocked.body.data.ballot_problem).toEqual('The candidature of Candidate B is not approved any more.');

            // Delegates do not see it yet.
            expect((await myVote('GET', election.voting, 10)).statusCode).toEqual(404);

            const fixed = await call('PUT', '/' + election.voting.id, {
                candidates: [election.candidates[0].id, election.candidates[2].id],
                opens_at: moment().add(1, 'hour').toISOString(),
                closes_at: moment().add(2, 'hours').toISOString()
            });
            expect(fixed.statusCode).toEqual(200);
            expect(fixed.body.data.status).toEqual('scheduled');
            expect(fixed.body.data.ballot_problem).toEqual(null);
            expect(fixed.body.data.options.map((option) => option.candidate_id)).toEqual([election.candidates[0].id, election.candidates[2].id]);
        });

        test('should not open after its time window passed, and ask the JC for a new time window when fixing the ballot', async () => {
            const election = await generator.createElection({
                opens_at: new Date(Date.now() - 3600 * 1000),
                closes_at: new Date(Date.now() - 1800 * 1000)
            }, event);
            await election.candidates[1].update({ status: 'rejected' });

            const blocked = await call('GET', '/' + election.voting.id);
            expect(blocked.body.data.status).toEqual('scheduled');
            expect(blocked.body.data.ballot_problem).toEqual('The candidature of Candidate B is not approved any more.');

            const withoutTimes = await call('PUT', '/' + election.voting.id, {
                candidates: [election.candidates[0].id, election.candidates[2].id]
            });
            expect(withoutTimes.statusCode).toEqual(422);
            expect(withoutTimes.body.message).toEqual('This election did not open on time: set a new opens_at and closes_at in the future.');

            const unchanged = await call('GET', '/' + election.voting.id);
            expect(unchanged.body.data.status).toEqual('scheduled');
            expect(unchanged.body.data.options.map((option) => option.candidate_id)).toEqual(election.candidates.map((candidate) => candidate.id));
            expect(await VotingDelegateVote.count({ where: { voting_id: election.voting.id } })).toEqual(0);

            const fixed = await call('PUT', '/' + election.voting.id, {
                candidates: [election.candidates[0].id, election.candidates[2].id],
                opens_at: moment().add(1, 'hour').toISOString(),
                closes_at: moment().add(2, 'hours').toISOString()
            });
            expect(fixed.statusCode).toEqual(200);
            expect(fixed.body.data.status).toEqual('scheduled');
            expect(fixed.body.data.ballot_problem).toEqual(null);

            // The new opens_at comes: moved into the past directly, so the test does not wait for it.
            await VotingDelegateVote.sequelize.query("UPDATE votings SET opens_at = now() - interval '1 second' WHERE id = :id", {
                replacements: { id: election.voting.id }
            });

            const opened = await call('GET', '/' + election.voting.id);
            expect(opened.body.data.status).toEqual('open');
            expect(opened.body.data.closed_at).toEqual(null);
            expect(opened.body.data.options.map((option) => option.outcome)).toEqual([null, null]);
            expect(await VotingDelegateVote.count({ where: { voting_id: election.voting.id } })).toEqual(3);
        });

        test('should not open after its time window passed, also with a valid ballot', async () => {
            const election = await generator.createElection({
                opens_at: new Date(Date.now() - 3600 * 1000),
                closes_at: new Date(Date.now() - 1800 * 1000)
            }, event);

            const warn = jest.spyOn(logger, 'warn');

            const res = await call('GET', '/' + election.voting.id);
            await call('GET', '');

            expect(res.body.data.status).toEqual('scheduled');
            expect(res.body.data.ballot_problem).toEqual('The time window of this election has passed: set a new opens_at and closes_at in the future.');
            expect(await VotingDelegateVote.count({ where: { voting_id: election.voting.id } })).toEqual(0);
            // Reading it does not try to open it again: no attempt, so no warning in the log.
            expect(warn.mock.calls.filter(([fields]) => fields && fields.voting === election.voting.id)).toEqual([]);

            const deleted = await call('DELETE', '/' + election.voting.id);
            expect(deleted.statusCode).toEqual(200);
        });

        test('should not open when the position was deleted', async () => {
            const election = await generator.createElection({ opens_at: new Date(Date.now() - 1000) }, event);
            await election.position.update({ deleted: true });

            const res = await call('GET', '/' + election.voting.id);

            expect(res.body.data.status).toEqual('scheduled');
            expect(res.body.data.ballot_problem).toEqual('The position of this election was deleted.');

            const deleted = await call('DELETE', '/' + election.voting.id);
            expect(deleted.statusCode).toEqual(200);
        });
    });

    describe('my vote', () => {
        test('should show the ballot and how many ballots the delegate can cast', async () => {
            const election = await openElection({ title: 'Election of the Comite Directeur', election_rule: 'absolute_majority' });

            const res = await myVote('GET', election.voting, 10);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toEqual({
                voting: {
                    id: election.voting.id,
                    event_id: event.id,
                    kind: 'election',
                    title: 'Election of the Comite Directeur',
                    description: election.voting.description,
                    majority: null,
                    phase: 'agora',
                    opens_at: new Date(election.voting.opens_at).toISOString(),
                    closes_at: new Date(election.voting.closes_at).toISOString(),
                    status: 'open',
                    position_id: election.position.id,
                    seats: 2,
                    election_rule: 'absolute_majority'
                },
                options: election.ballot.map((option) => ({ id: option.id, label: option.label, ballot_order: option.ballot_order })),
                body: { body_id: 34, votes_total: 5, delegates_count: 3, votes_cast: 0 },
                body_id: 34,
                max_votes: 2,
                votes_available: 2,
                ballots_cast: 0,
                submitted_at: null
            });
        });

        // The example of the design: a body of 5 votes, 3 delegates, 2 seats, candidates A, B and C.
        test('should store each ballot once, keep the rules of the body, and never show what is on the ballots', async () => {
            const election = await openElection();
            const [A, B, C] = election.ballot.map((option) => option.id);

            const anna = await myVote('PUT', election.voting, 10, { ballots: [[A, B], [C]] });
            expect(anna.statusCode).toEqual(200);
            expect(anna.body.data).toMatchObject({ ballots_cast: 2, votes_available: 0 });
            expect(anna.body.data.submitted_at).not.toEqual(null);
            expect(JSON.stringify(anna.body.data)).not.toContain('"ballots"');

            const bram = await myVote('PUT', election.voting, 11, { ballots: [[A], []] });
            expect(bram.statusCode).toEqual(200);

            const chris = await myVote('PUT', election.voting, 12, { ballots: [[B], [C]] });
            expect(chris.statusCode).toEqual(409);
            expect(chris.body.message).toEqual('Your body has only 1 of its 5 votes left.');

            expect((await myVote('PUT', election.voting, 12, { ballots: [[B, C]] })).statusCode).toEqual(200);

            const again = await myVote('PUT', election.voting, 10, { ballots: [[A]] });
            expect(again.statusCode).toEqual(409);
            expect(again.body.message).toContain('already voted');

            const read = await myVote('GET', election.voting, 10);
            expect(read.body.data).toMatchObject({ ballots_cast: 2 });
            expect(Object.keys(read.body.data)).not.toContain('ballots');

            const rows = await VotingDelegateVote.findAll({ where: { voting_id: election.voting.id }, order: [['user_id', 'ASC']] });
            expect(rows.map((row) => [row.ballots_cast, row.in_favour, row.against, row.abstention])).toEqual([[2, 0, 0, 0], [2, 0, 0, 0], [1, 0, 0, 0]]);
        });

        test('should tell when the extra vote of the body is already used', async () => {
            await VotesPerAntenna.update({ votes: 4 }, { where: { event_id: event.id, body_id: 34 } });
            const election = await openElection();
            const [A] = election.ballot.map((option) => option.id);
            await myVote('PUT', election.voting, 10, { ballots: [[A], [A]] });

            const res = await myVote('PUT', election.voting, 11, { ballots: [[A], [A]] });

            expect(res.statusCode).toEqual(409);
            expect(res.body.message).toContain('at most 1 votes');
        });

        test.each([
            ['no ballots field', {}, 'should be a list of ballots'],
            ['ballots that are not a list', { ballots: 'A' }, 'should be a list of ballots'],
            ['a ballot that is not a list', { ballots: [1] }, 'should be a list of ballots'],
            ['a mark that is not a whole number', { ballots: [['x']] }, 'should be a list of ballots'],
            ['no ballots', { ballots: [] }, 'at least one ballot'],
            ['more ballots than votes', { ballots: [[], [], []] }, 'at most 2 ballots'],
            ['more marks than seats', { ballots: [['A', 'B', 'C']] }, 'at most 2 candidates'],
            ['a candidate twice on one ballot', { ballots: [['A', 'A']] }, 'only once'],
            ['a candidate of another election', { ballots: [['other']] }, 'only mark candidates of this election'],
            ['in favour, against or abstention', { in_favour: 1 }, 'voted with ballots']
        ])('should refuse %s', async (name, body, message) => {
            const election = await openElection();
            const other = await generator.createElection({}, event, { candidatesCount: 1 });
            const ids = { A: election.ballot[0].id, B: election.ballot[1].id, C: election.ballot[2].id, other: other.ballot[0].id };
            const resolve = (value) => (Array.isArray(value)
                ? value.map((ballot) => (Array.isArray(ballot) ? ballot.map((mark) => (mark in ids ? ids[mark] : mark)) : ballot))
                : value);

            const res = await myVote('PUT', election.voting, 10, { ...body, ...('ballots' in body ? { ballots: resolve(body.ballots) } : {}) });

            expect(res.statusCode).toEqual(422);
            expect(res.body.message).toContain(message);
            const row = await VotingDelegateVote.findOne({ where: { voting_id: election.voting.id, user_id: 10 } });
            expect(row.submitted_at).toEqual(null);
        });

        // Statutory logs a request with only the ID of the user and without the body (lib/morgan.js),
        // and the ballot box does not log its queries, so the log never holds what a delegate voted.
        test('should log the vote route without the ballots and without the name of the delegate', async () => {
            const election = await openElection();
            const [A, B] = election.ballot.map((option) => option.id);
            const info = jest.spyOn(logger, 'info');

            const res = await myVote('PUT', election.voting, 10, { ballots: [[A, B], []] });
            expect(res.statusCode).toEqual(200);
            await myVote('GET', election.voting, 10);

            const lines = info.mock.calls.filter(([fields]) => fields && typeof fields.url === 'string' && fields.url.includes('/my-vote'));
            expect(lines.map(([fields]) => fields.method)).toEqual(['PUT', 'GET']);
            for (const [fields] of lines) {
                expect(Object.keys(fields.user)).toEqual(['id']);
                expect(fields.body).toEqual(undefined);
                expect(JSON.stringify(fields)).not.toContain('"ballots"');
            }
        });
    });

    describe('closing and the result', () => {
        // Anna [A, B] and [A]; Bram [A, C] and a blank ballot; Chris [B]: 5 ballots, A 3, B 2, C 1.
        // Absolute majority: more than half of the 5 ballots cast (the blank one counts), so 3 or more.
        const voteAndClose = async () => {
            const election = await openElection({ election_rule: 'absolute_majority' });
            const [A, B, C] = election.ballot.map((option) => option.id);
            expect((await myVote('PUT', election.voting, 10, { ballots: [[A, B], [A]] })).statusCode).toEqual(200);
            expect((await myVote('PUT', election.voting, 11, { ballots: [[A, C], []] })).statusCode).toEqual(200);
            expect((await myVote('PUT', election.voting, 12, { ballots: [[B]] })).statusCode).toEqual(200);
            await generator.closeVoting(election.voting);
            return election;
        };

        test('should count the votes per candidate and store the outcomes at closing', async () => {
            const election = await voteAndClose();

            const res = await call('GET', '/' + election.voting.id + '/result');

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({
                election_rule: 'absolute_majority',
                seats: 2,
                published: false,
                ballots_cast: 5,
                blank_ballots: 1,
                votes_total: 5,
                votes_cast: 5,
                bodies_available: 1,
                bodies_present: 1
            });
            expect(res.body.data.result).toEqual(undefined);
            expect(res.body.data.bodies).toEqual(undefined);
            expect(res.body.data.candidates).toEqual([
                { option_id: election.ballot[0].id, candidate_id: election.candidates[0].id, label: 'Candidate A', ballot_order: 1, votes: 3, percentage: 60, reaches_threshold: true, outcome: 'elected' },
                { option_id: election.ballot[1].id, candidate_id: election.candidates[1].id, label: 'Candidate B', ballot_order: 2, votes: 2, percentage: 40, reaches_threshold: false, outcome: 'not_elected' },
                { option_id: election.ballot[2].id, candidate_id: election.candidates[2].id, label: 'Candidate C', ballot_order: 3, votes: 1, percentage: 20, reaches_threshold: false, outcome: 'not_elected' }
            ]);

            const voting = await call('GET', '/' + election.voting.id);
            expect(voting.body.data.result).toEqual(null);
            expect(voting.body.data.options.map((option) => option.outcome)).toEqual(['elected', 'not_elected', 'not_elected']);
        });

        test('should show the result to other users only after the JC published it', async () => {
            const election = await voteAndClose();
            mock.mockAll({ core: { userFromToken: true }, mainPermissions: { noPermissions: true } });

            const hidden = await call('GET', '/' + election.voting.id + '/result');
            expect(hidden.statusCode).toEqual(409);
            const voting = await call('GET', '/' + election.voting.id);
            expect(voting.body.data.options.map((option) => option.outcome)).toEqual([null, null, null]);

            mock.mockAll({ core: { userFromToken: true } });
            expect((await call('PUT', '/' + election.voting.id + '/publish')).statusCode).toEqual(200);

            mock.mockAll({ core: { userFromToken: true }, mainPermissions: { noPermissions: true } });
            const shown = await call('GET', '/' + election.voting.id + '/result');
            expect(shown.statusCode).toEqual(200);
            expect(shown.body.data.candidates.map((candidate) => [candidate.votes, candidate.outcome])).toEqual([[3, 'elected'], [2, 'not_elected'], [1, 'not_elected']]);
        });

        test('should show the JC who voted while the election is open, but not what', async () => {
            const election = await openElection();
            const [A] = election.ballot.map((option) => option.id);
            await myVote('PUT', election.voting, 10, { ballots: [[A], []] });

            const res = await call('GET', '/' + election.voting.id + '/progress');

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({ votes_total: 5, votes_cast: 2, bodies_present: 1 });
            expect(res.body.data.bodies[0].delegates.map((delegate) => delegate.voted)).toEqual([true, false, false]);
            expect(JSON.stringify(res.body.data)).not.toContain('"votes":');
        });
    });
});
