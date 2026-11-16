const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const cron = require('../../lib/cron');

// A proposal is an item on the agenda of an Agora. Its proposer submits it in MyAEGEE: a title, the
// names of the proposers, the part of the CIA it changes and a link to its text and motivation; the
// text itself stays outside MyAEGEE. The JC puts it on the agenda, or does not admit it with a reason
// (WF Agora Art. 8(2)). The proposer can withdraw it. Every logged-in user sees a proposal that was on
// the agenda, also once withdrawn; a submitted, not admitted or never admitted withdrawn one only its
// proposer and the JC see.
// All people, bodies and texts are made up.
describe('Proposals', () => {
    // A token 'user-<id>' is that user; asJC() gives every user the rights of the JC, asMember() none.
    const ANNA = 'user-101';
    const BEN = 'user-102';
    let event;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    const asJC = () => mock.mockAll({ core: { userFromToken: true } });
    const asMember = () => mock.mockAll({ core: { userFromToken: true }, mainPermissions: { noPermissions: true } });

    beforeEach(async () => {
        asMember();
        event = await generator.createEvent({ type: 'agora', applications: [] });
    });

    afterEach(async () => {
        mock.cleanAll();
        cron.clearAll();
        await generator.clearAll();
    });

    const call = (method, path, body, token = ANNA) => request({
        path: '/events/' + event.id + '/proposals' + path,
        method,
        headers: { 'X-Auth-Token': token },
        body
    });

    const submission = (fields = {}) => ({
        title: 'Longer draft period',
        proposers: 'Anna Example on behalf of AEGEE-Atlantis',
        cia_part: 'working_format',
        text_url: 'https://example.org/longer-draft-period',
        ...fields
    });

    const submit = async (fields, token = ANNA) => {
        const res = await call('POST', '', submission(fields), token);
        expect(res.statusCode).toEqual(200);
        return res.body.data;
    };

    const setStatus = (proposal, body, token = ANNA) => call('PUT', '/' + proposal.id + '/status', body, token);

    describe('submitting', () => {
        test('should let every logged-in user submit a proposal, as its proposer', async () => {
            const res = await call('POST', '', submission({ status: 'on_agenda', created_by: 7, decision: 'accepted' }));

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({
                event_id: event.id,
                title: 'Longer draft period',
                proposers: 'Anna Example on behalf of AEGEE-Atlantis',
                cia_part: 'working_format',
                text_url: 'https://example.org/longer-draft-period',
                created_by: 101,
                status: 'submitted',
                jc_reason: null,
                decision: null,
                decided_by_voting_id: null
            });
        });

        test.each([
            ['title', { title: '' }],
            ['proposers', { proposers: '' }],
            ['cia_part', { cia_part: 'regulations' }],
            ['text_url', { text_url: 'page 4 of my document' }]
        ])('should refuse a proposal with an invalid %s', async (field, fields) => {
            const res = await call('POST', '', submission(fields));

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty(field);
        });

        test('should only accept proposals for an Agora', async () => {
            event = await generator.createEvent({ type: 'epm', applications: [] });
            const res = await call('POST', '', submission());

            expect(res.statusCode).toEqual(400);
        });
    });

    describe('reading', () => {
        // Anna submitted one proposal, Ben one that the JC put on the agenda and one that it did not admit.
        const setUpProposals = async () => {
            const annas = await submit({ title: 'Submitted by Anna' });
            const onAgenda = await generator.createProposal({ title: 'On the agenda', created_by: 102, status: 'on_agenda' }, event);
            const notAdmitted = await generator.createProposal({
                title: 'Not admitted',
                created_by: 102,
                status: 'not_admitted',
                jc_reason: 'This does not change the CIA.'
            }, event);
            await generator.createProposal({ title: 'Of another Agora', status: 'on_agenda' }, await generator.createEvent({ type: 'agora', applications: [] }));
            return { annas, onAgenda, notAdmitted };
        };

        const titlesFor = async (token) => {
            const res = await call('GET', '', undefined, token);
            expect(res.statusCode).toEqual(200);
            return res.body.data.map((proposal) => proposal.title);
        };

        test('should show every logged-in user the proposals on the agenda, and only the proposer and the JC the others', async () => {
            await setUpProposals();

            expect(await titlesFor('user-103')).toEqual(['On the agenda']);
            expect(await titlesFor(ANNA)).toEqual(['Submitted by Anna', 'On the agenda']);
            expect(await titlesFor(BEN)).toEqual(['On the agenda', 'Not admitted']);

            asJC();
            expect(await titlesFor('user-103')).toEqual(['Submitted by Anna', 'On the agenda', 'Not admitted']);
        });

        test('should show the reason of the JC only to the proposer and the JC', async () => {
            const { notAdmitted } = await setUpProposals();

            const own = await call('GET', '/' + notAdmitted.id, undefined, BEN);
            expect(own.statusCode).toEqual(200);
            expect(own.body.data.jc_reason).toEqual('This does not change the CIA.');

            expect((await call('GET', '/' + notAdmitted.id, undefined, 'user-103')).statusCode).toEqual(404);

            asJC();
            expect((await call('GET', '/' + notAdmitted.id, undefined, 'user-103')).body.data.jc_reason).toEqual('This does not change the CIA.');
        });

        test('should show one proposal on the agenda to every logged-in user, but not a submitted one', async () => {
            const { annas, onAgenda } = await setUpProposals();

            const res = await call('GET', '/' + onAgenda.id, undefined, 'user-103');
            expect(res.statusCode).toEqual(200);
            expect(res.body.data.title).toEqual('On the agenda');

            expect((await call('GET', '/' + annas.id, undefined, 'user-103')).statusCode).toEqual(404);
            expect((await call('GET', '/' + annas.id)).statusCode).toEqual(200);
        });

        test('should not find a proposal of another Agora, or an invalid ID', async () => {
            const other = await generator.createProposal({ status: 'on_agenda' }, await generator.createEvent({ type: 'agora', applications: [] }));

            expect((await call('GET', '/' + other.id)).statusCode).toEqual(404);
            expect((await call('GET', '/abc')).statusCode).toEqual(400);
        });
    });

    describe('the JC puts it on the agenda or does not admit it', () => {
        test('should put a proposal on the agenda', async () => {
            const proposal = await submit();
            asJC();
            const res = await setStatus(proposal, { status: 'on_agenda' }, BEN);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.status).toEqual('on_agenda');
        });

        test('should not admit a proposal, with a reason', async () => {
            const proposal = await submit();
            asJC();
            const withoutReason = await setStatus(proposal, { status: 'not_admitted' }, BEN);
            expect(withoutReason.statusCode).toEqual(422);

            const res = await setStatus(proposal, { status: 'not_admitted', jc_reason: 'This does not change the CIA.' }, BEN);
            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({ status: 'not_admitted', jc_reason: 'This does not change the CIA.' });
        });

        test('should refuse a user who is not in the JC, also the proposer', async () => {
            const proposal = await submit();

            expect((await setStatus(proposal, { status: 'on_agenda' })).statusCode).toEqual(403);
            expect((await setStatus(proposal, { status: 'not_admitted', jc_reason: 'No.' })).statusCode).toEqual(403);
        });

        test('should refuse a step that the flow does not have', async () => {
            const proposal = await submit();
            asJC();
            await setStatus(proposal, { status: 'on_agenda' }, BEN);

            const back = await setStatus(proposal, { status: 'submitted' }, BEN);
            expect(back.statusCode).toEqual(409);
            const notAdmitted = await setStatus(proposal, { status: 'not_admitted', jc_reason: 'Too late.' }, BEN);
            expect(notAdmitted.statusCode).toEqual(409);
        });

        test('should refuse an unknown status', async () => {
            const proposal = await submit();
            asJC();
            const res = await setStatus(proposal, { status: 'accepted' }, BEN);

            expect(res.statusCode).toEqual(422);
        });
    });

    describe('withdrawing', () => {
        test('should let the proposer withdraw a submitted proposal and a proposal on the agenda', async () => {
            const submitted = await submit();
            const res = await setStatus(submitted, { status: 'withdrawn' });
            expect(res.statusCode).toEqual(200);
            expect(res.body.data.status).toEqual('withdrawn');

            const onAgenda = await generator.createProposal({ created_by: 101, status: 'on_agenda' }, event);
            expect((await setStatus(onAgenda, { status: 'withdrawn' })).statusCode).toEqual(200);
        });

        test('should let the JC withdraw it, but not another user', async () => {
            // Another user does not even see a submitted proposal, and may not withdraw one on the agenda.
            const proposal = await submit();
            expect((await setStatus(proposal, { status: 'withdrawn' }, BEN)).statusCode).toEqual(404);
            const onAgenda = await generator.createProposal({ created_by: 101, status: 'on_agenda' }, event);
            expect((await setStatus(onAgenda, { status: 'withdrawn' }, BEN)).statusCode).toEqual(403);

            asJC();
            expect((await setStatus(proposal, { status: 'withdrawn' }, BEN)).statusCode).toEqual(200);
        });

        test('should keep a withdrawn proposal that was on the agenda visible to every logged-in user, without the reason of the JC', async () => {
            const proposal = await submit();
            asJC();
            expect((await setStatus(proposal, { status: 'on_agenda', jc_reason: 'Admitted after a late check.' }, BEN)).statusCode).toEqual(200);
            asMember();
            expect((await setStatus(proposal, { status: 'withdrawn' })).statusCode).toEqual(200);

            const res = await call('GET', '/' + proposal.id, undefined, BEN);
            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({ status: 'withdrawn', jc_reason: null });
            expect(res.body.data.on_agenda_at).not.toEqual(null);

            const list = await call('GET', '', undefined, BEN);
            expect(list.statusCode).toEqual(200);
            expect(list.body.data.map((shown) => [shown.id, shown.status])).toEqual([[proposal.id, 'withdrawn']]);
        });

        test('should show a proposal withdrawn before it was on the agenda only to its proposer and the JC', async () => {
            const proposal = await submit();
            expect((await setStatus(proposal, { status: 'withdrawn' })).statusCode).toEqual(200);

            expect((await call('GET', '/' + proposal.id, undefined, BEN)).statusCode).toEqual(404);
            expect((await call('GET', '', undefined, BEN)).body.data).toEqual([]);

            expect((await call('GET', '/' + proposal.id)).body.data.status).toEqual('withdrawn');
            asJC();
            const forJC = await call('GET', '', undefined, BEN);
            expect(forJC.body.data.map((shown) => [shown.id, shown.status])).toEqual([[proposal.id, 'withdrawn']]);
        });

        test('should refuse to withdraw while the Agora votes on it', async () => {
            const proposal = await generator.createProposal({ created_by: 101, status: 'on_agenda' }, event);
            await generator.createOpenVoting({ kind: 'proposal', majority: 'simple', proposal_id: proposal.id }, event);

            const res = await setStatus(proposal, { status: 'withdrawn' });
            expect(res.statusCode).toEqual(409);
            expect(res.body.message).toEqual('A proposal cannot be withdrawn once the Agora votes on it.');
        });
    });
});
