const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const cron = require('../../lib/cron');
const { Proposal, VotesPerAntenna, Voting } = require('../../models');

// A voting of kind 'proposal' can point to a proposal on the agenda of the same Agora (proposal_id).
// The part of the CIA of that proposal decides the majority and, before the Agora, the Statutes flag;
// the database refuses others. A voting without a proposal works as before.
// The decision of the Agora is stored on the proposal, as a checked copy of the voting that decided it:
// when the JC publishes a voting on the Agora, or when a Pre-Agora voting closes as decided.
// All people, bodies and texts are made up.
describe('Votings on proposals', () => {
    let event;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll({ core: { userFromToken: true } });
        event = await generator.createEvent({ type: 'agora', applications: [] });
    });

    afterEach(async () => {
        mock.cleanAll();
        cron.clearAll();
        await generator.clearAll();
    });

    const call = (method, path, body, token = 'blablabla') => request({
        path: '/events/' + event.id + path,
        method,
        headers: { 'X-Auth-Token': token },
        body
    });

    const window = () => ({
        opens_at: moment().add(1, 'day').toDate(),
        closes_at: moment().add(1, 'day').add(1, 'hour').toDate()
    });

    const createVoting = (fields) => call('POST', '/votings', {
        kind: 'proposal',
        title: 'Proposal: longer draft period',
        majority: 'simple',
        ...window(),
        ...fields
    });

    const onAgenda = (fields = {}) => generator.createProposal({ status: 'on_agenda', title: 'Longer draft period', ...fields }, event);

    const readProposal = async (proposal) => {
        const res = await call('GET', '/proposals/' + proposal.id);
        expect(res.statusCode).toEqual(200);
        return res.body.data;
    };

    // A body with 3 votes and one present delegate (user 11), who votes these counts.
    const voteWithOneDelegate = async (voting, counts) => {
        const res = await call('PUT', '/votings/' + voting.id + '/my-vote', counts, 'user-11');
        expect(res.statusCode).toEqual(200);
    };
    const setUpPresentDelegate = async () => {
        await VotesPerAntenna.create({ event_id: event.id, body_id: 1, votes: 3 });
        await generator.createPresentDelegate({ user_id: 11, body_id: 1 }, event);
    };

    const closeAndRead = async (voting) => {
        await generator.endVotingTime(voting);
        const res = await call('GET', '/votings/' + voting.id);
        expect(res.statusCode).toEqual(200);
        expect(res.body.data.status).toEqual('closed');
        return res.body.data;
    };

    describe('creating', () => {
        test('should create a voting on a proposal of a working format with a simple majority', async () => {
            const proposal = await onAgenda({ cia_part: 'working_format' });
            const res = await createVoting({ proposal_id: proposal.id });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({ proposal_id: proposal.id, majority: 'simple', phase: 'agora' });
        });

        test('should vote on a change of the Statutes with 2/3, and before the Agora marked as a change of the Statutes', async () => {
            event = await generator.createAgoraStartingIn(10);
            const proposal = await onAgenda({ cia_part: 'statutes' });

            const agora = await createVoting({ proposal_id: proposal.id, majority: 'two_thirds' });
            expect(agora.statusCode).toEqual(200);
            expect(agora.body.data).toMatchObject({ majority: 'two_thirds', concerns_statutes: false });

            const preAgora = await createVoting({
                proposal_id: proposal.id,
                phase: 'pre_agora',
                majority: 'two_thirds',
                concerns_statutes: true,
                opens_at: moment().add(1, 'hour').toDate(),
                closes_at: moment().add(2, 'hours').toDate()
            });
            expect(preAgora.statusCode).toEqual(200);
            expect(preAgora.body.data).toMatchObject({ majority: 'two_thirds', concerns_statutes: true });
        });

        // The JC screen creates proposal votings with a title only; that keeps working until the frontend
        // asks for the proposal. Without a proposal, none of the rules of a proposal apply.
        test('should still create a proposal voting without a proposal, with any majority', async () => {
            const res = await createVoting({ title: 'Only a title', majority: 'absolute' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({ kind: 'proposal', proposal_id: null, majority: 'absolute' });
        });

        test('should refuse a proposal of another Agora, or one that does not exist', async () => {
            const elsewhere = await generator.createProposal({ status: 'on_agenda' }, await generator.createEvent({ type: 'agora', applications: [] }));

            for (const proposalId of [elsewhere.id, elsewhere.id + 1000]) {
                const res = await createVoting({ proposal_id: proposalId });
                expect(res.statusCode).toEqual(422);
                expect(res.body.message).toEqual('The proposal should be a proposal of this Agora.');
            }
        });

        test.each([
            ['submitted', {}],
            ['not_admitted', { jc_reason: 'Not a change of the CIA.' }],
            ['withdrawn', {}]
        ])('should refuse a proposal that is %s', async (status, fields) => {
            const proposal = await generator.createProposal({ status, ...fields }, event);
            const res = await createVoting({ proposal_id: proposal.id });

            expect(res.statusCode).toEqual(409);
            expect(res.body.message).toEqual('Only a proposal on the agenda can be voted on.');
        });

        test('should refuse a majority that does not fit the part of the CIA', async () => {
            const proposal = await onAgenda({ cia_part: 'other' });
            const res = await createVoting({ proposal_id: proposal.id, majority: 'absolute' });

            expect(res.statusCode).toEqual(422);
            expect(res.body.message).toEqual('This voting needs the majority simple.');
        });

        test('should refuse a Pre-Agora voting on a change of the Statutes that is not marked as one', async () => {
            event = await generator.createAgoraStartingIn(10);
            const proposal = await onAgenda({ cia_part: 'statutes' });
            const res = await createVoting({
                proposal_id: proposal.id,
                phase: 'pre_agora',
                majority: 'two_thirds',
                concerns_statutes: false,
                opens_at: moment().add(1, 'hour').toDate(),
                closes_at: moment().add(2, 'hours').toDate()
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.message).toEqual('A Pre-Agora voting concerns the Statutes exactly when its proposal does.');
        });

        test('should only let a proposal voting point to a proposal', async () => {
            const proposal = await onAgenda();
            const res = await createVoting({ kind: 'rollcall', majority: 'simple', proposal_id: proposal.id });

            expect(res.statusCode).toEqual(422);
        });

        test('should let a rollcall be created as before, without a proposal', async () => {
            const res = await createVoting({ kind: 'rollcall', title: 'Roll call', majority: 'absolute' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.proposal_id).toEqual(null);
        });
    });

    describe('editing', () => {
        test('should move a scheduled voting to another proposal, with the majority of that proposal', async () => {
            const first = await onAgenda({ cia_part: 'other' });
            const second = await onAgenda({ cia_part: 'statutes', title: 'Change of the Statutes' });
            const created = await createVoting({ proposal_id: first.id });

            const withoutMajority = await call('PUT', '/votings/' + created.body.data.id, { proposal_id: second.id });
            expect(withoutMajority.statusCode).toEqual(422);
            expect(withoutMajority.body.message).toEqual('This voting needs the majority two_thirds.');

            const res = await call('PUT', '/votings/' + created.body.data.id, { proposal_id: second.id, majority: 'two_thirds' });
            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({ proposal_id: second.id, majority: 'two_thirds' });
        });

        test('should refuse to move it to a proposal that is not on the agenda', async () => {
            const first = await onAgenda();
            const submitted = await generator.createProposal({}, event);
            const created = await createVoting({ proposal_id: first.id });

            const res = await call('PUT', '/votings/' + created.body.data.id, { proposal_id: submitted.id });
            expect(res.statusCode).toEqual(409);
        });
    });

    describe('the decision of the Agora', () => {
        test('should store the decision on the proposal when the JC publishes the voting on the Agora', async () => {
            await setUpPresentDelegate();
            const proposal = await onAgenda();
            const voting = await generator.createOpenVoting({ kind: 'proposal', majority: 'simple', proposal_id: proposal.id }, event);
            await voteWithOneDelegate(voting, { in_favour: 2, against: 1 });

            const closed = await closeAndRead(voting);
            expect(closed.result).toEqual('accepted');
            expect((await readProposal(proposal)).decision).toEqual(null);

            const published = await call('PUT', '/votings/' + voting.id + '/publish');
            expect(published.statusCode).toEqual(200);

            const decided = await readProposal(proposal);
            expect(decided).toMatchObject({ status: 'on_agenda', decision: 'accepted', decided_by_voting_id: voting.id });
            expect(decided.decided_at).not.toEqual(null);
        });

        test('should store a rejection too, and refuse another voting on the decided proposal', async () => {
            const proposal = await onAgenda();
            const voting = await generator.createOpenVoting({ kind: 'proposal', majority: 'simple', proposal_id: proposal.id }, event);
            await closeAndRead(voting);
            expect((await call('PUT', '/votings/' + voting.id + '/publish')).statusCode).toEqual(200);
            expect((await readProposal(proposal)).decision).toEqual('rejected');

            const again = await createVoting({ proposal_id: proposal.id });
            expect(again.statusCode).toEqual(409);
            expect(again.body.message).toEqual('The Agora already decided on this proposal.');
        });

        test('should publish a proposal voting without a proposal as before, without a decision', async () => {
            const voting = await generator.createOpenVoting({ kind: 'proposal', majority: 'absolute' }, event);

            const closed = await closeAndRead(voting);
            expect(closed.proposal_id).toEqual(null);
            expect((await call('PUT', '/votings/' + voting.id + '/publish')).statusCode).toEqual(200);
        });
    });

    describe('withdrawing a proposal that has a voting', () => {
        test('should keep its planned voting from opening, show the JC why, and let the JC delete it', async () => {
            const proposal = await onAgenda();
            const created = await createVoting({ proposal_id: proposal.id });
            const votingId = created.body.data.id;
            expect(created.body.data.proposal_problem).toEqual(null);

            expect((await call('PUT', '/proposals/' + proposal.id + '/status', { status: 'withdrawn' })).statusCode).toEqual(200);
            await Voting.update({ opens_at: new Date(Date.now() - 1000) }, { where: { id: votingId } });

            const res = await call('GET', '/votings/' + votingId);
            expect(res.statusCode).toEqual(200);
            expect(res.body.data.status).toEqual('scheduled');
            expect(res.body.data.proposal_problem).toEqual('The proposal of this voting is not on the agenda (withdrawn).');

            const list = await call('GET', '/votings');
            expect(list.statusCode).toEqual(200);
            expect(list.body.data.find((voting) => voting.id === votingId).status).toEqual('scheduled');

            expect((await call('DELETE', '/votings/' + votingId)).statusCode).toEqual(200);
        });

        test('should not show the problem to a user who is not in the JC', async () => {
            const proposal = await onAgenda();
            const voting = await generator.createOpenVoting({ kind: 'proposal', majority: 'simple', proposal_id: proposal.id }, event);

            mock.mockAll({ core: { userFromToken: true }, mainPermissions: { noPermissions: true } });
            const res = await call('GET', '/votings/' + voting.id);
            expect(res.statusCode).toEqual(200);
            expect(res.body.data).not.toHaveProperty('proposal_problem');
        });
    });

    describe('Pre-Agora Voting', () => {
        // The Agora starts in 10 days, so the Pre-Agora window (days 14 to 9) runs from 4 days ago to tomorrow.
        // Antennae 1 to 4 have 3 votes and one delegate each (users 11 to 14), not checked in yet.
        beforeEach(async () => {
            mock.mockAll({ core: { userFromToken: true }, bodies: { antennae: 4 } });
            event = await generator.createAgoraStartingIn(10);
            for (const bodyId of [1, 2, 3, 4]) {
                await VotesPerAntenna.create({ event_id: event.id, body_id: bodyId, votes: 3 });
                await generator.createUpcomingDelegate({ user_id: 10 + bodyId, body_id: bodyId }, event);
            }
        });

        const vote = async (voting, userId, counts) => {
            const res = await call('PUT', '/votings/' + voting.id + '/my-vote', counts, 'user-' + userId);
            expect(res.statusCode).toEqual(200);
        };

        // Accepted with quorum: two of the four Antennae vote in favour.
        const preAgoraAccepted = async (proposal, fields = {}) => {
            const voting = await generator.createOpenVoting({ kind: 'proposal', phase: 'pre_agora', proposal_id: proposal.id, ...fields }, event);
            await vote(voting, 11, { in_favour: 3 });
            await vote(voting, 12, { in_favour: 3 });
            return { voting, closed: await closeAndRead(voting) };
        };

        test('should not open again or ask core for a planned voting whose proposal was withdrawn, and let the JC delete it', async () => {
            const proposal = await onAgenda();
            const voting = await generator.createVoting({
                kind: 'proposal',
                phase: 'pre_agora',
                proposal_id: proposal.id,
                opens_at: moment().add(1, 'hour').toDate(),
                closes_at: moment().add(2, 'hours').toDate()
            }, event);
            expect((await call('PUT', '/proposals/' + proposal.id + '/status', { status: 'withdrawn' })).statusCode).toEqual(200);
            await Voting.update({ opens_at: new Date(Date.now() - 1000) }, { where: { id: voting.id } });

            mock.mockAll({ core: { userFromToken: true }, bodies: { netError: true } });
            const res = await call('GET', '/votings/' + voting.id);
            expect(res.statusCode).toEqual(200);
            expect(res.body.data.status).toEqual('scheduled');
            expect(res.body.data.proposal_problem).toEqual('The proposal of this voting is not on the agenda (withdrawn).');

            expect((await call('GET', '/votings')).statusCode).toEqual(200);
            expect((await call('DELETE', '/votings/' + voting.id)).statusCode).toEqual(200);
        });

        const markAmendment = (voting, value) => call('PUT', '/votings/' + voting.id + '/amendment', { amendment_submitted: value });

        test('should store the decision at closing when the item is decided before the Agora', async () => {
            const proposal = await onAgenda();
            const { voting, closed } = await preAgoraAccepted(proposal);

            expect(closed).toMatchObject({ outcome: 'decided', published: true });
            expect(await readProposal(proposal)).toMatchObject({ decision: 'accepted', decided_by_voting_id: voting.id });
            expect((await call('PUT', '/proposals/' + proposal.id + '/status', { status: 'withdrawn' })).statusCode).toEqual(409);
        });

        test('should not decide a change of the Statutes before the Agora; the Agora votes again with 2/3', async () => {
            const proposal = await onAgenda({ cia_part: 'statutes' });
            const { voting, closed } = await preAgoraAccepted(proposal, { concerns_statutes: true });

            expect(closed).toMatchObject({ outcome: 'to_agora', outcome_reason: 'statutes' });
            expect((await readProposal(proposal)).decision).toEqual(null);

            const following = await createVoting({ proposal_id: proposal.id, majority: 'two_thirds', follows_voting_id: voting.id });
            expect(following.statusCode).toEqual(200);
            expect(following.body.data).toMatchObject({ majority: 'two_thirds', follows_voting_id: voting.id });
        });

        // WF Agora Art. 20(5): an amendment submitted at least five days before the Agora sends the item to the Agora.
        test('should take the decision away when the JC marks an amendment, and give it back when the JC unmarks it', async () => {
            const proposal = await onAgenda();
            const { voting } = await preAgoraAccepted(proposal);

            const marked = await markAmendment(voting, true);
            expect(marked.statusCode).toEqual(200);
            expect(marked.body.data.outcome).toEqual('to_agora');
            expect(await readProposal(proposal)).toMatchObject({ decision: null, decided_by_voting_id: null, decided_at: null });

            const unmarked = await markAmendment(voting, false);
            expect(unmarked.statusCode).toEqual(200);
            expect(await readProposal(proposal)).toMatchObject({ decision: 'accepted', decided_by_voting_id: voting.id });
        });

        test('should refuse to unmark the amendment once the proposer withdrew the proposal', async () => {
            const proposal = await onAgenda();
            const { voting } = await preAgoraAccepted(proposal);
            expect((await markAmendment(voting, true)).statusCode).toEqual(200);
            expect((await call('PUT', '/proposals/' + proposal.id + '/status', { status: 'withdrawn' })).statusCode).toEqual(200);

            const res = await markAmendment(voting, false);
            expect(res.statusCode).toEqual(409);
            expect((await Voting.findByPk(voting.id)).outcome).toEqual('to_agora');
            expect((await Proposal.findByPk(proposal.id)).decision).toEqual(null);
        });
    });
});
