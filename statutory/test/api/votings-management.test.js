const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Voting } = require('../../models');

describe('Votings management', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll();
    });

    afterEach(async () => {
        mock.cleanAll();
        await generator.clearAll();
    });

    const call = (method, path, body) => request({
        path,
        method,
        headers: { 'X-Auth-Token': 'blablabla' },
        body
    });

    describe('creating', () => {
        test('should create a draft voting', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });

            const res = await call('POST', '/events/' + event.id + '/votings', {
                kind: 'proposal',
                title: 'Change of the Statutes',
                description: 'Proposal to change article 1.',
                majority: 'two_thirds',
                status: 'open',
                result: 'accepted'
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body.data.event_id).toEqual(event.id);
            expect(res.body.data.kind).toEqual('proposal');
            expect(res.body.data.title).toEqual('Change of the Statutes');
            expect(res.body.data.majority).toEqual('two_thirds');
            expect(res.body.data.status).toEqual('draft'); // status and result cannot be set directly
            expect(res.body.data.result).toEqual(null);
        });

        test('should create a rollcall', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });

            const res = await call('POST', '/events/' + event.id + '/votings', generator.generateVoting({ kind: 'rollcall', majority: 'simple' }));

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.kind).toEqual('rollcall');
        });

        test('should fail on an unknown kind', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });

            const res = await call('POST', '/events/' + event.id + '/votings', generator.generateVoting({ kind: 'election' }));

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('kind');
        });

        test('should fail on an unknown majority', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });

            const res = await call('POST', '/events/' + event.id + '/votings', generator.generateVoting({ majority: 'most' }));

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('majority');
        });

        test('should fail without a title', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });

            const res = await call('POST', '/events/' + event.id + '/votings', generator.generateVoting({ title: '' }));

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('title');
        });

        test('should fail without the permission', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const event = await generator.createEvent({ type: 'agora', applications: [] });

            const res = await call('POST', '/events/' + event.id + '/votings', generator.generateVoting());

            expect(res.statusCode).toEqual(403);
            expect(res.body.success).toEqual(false);
        });

        test('should fail for an event that is not an Agora', async () => {
            const event = await generator.createEvent({ type: 'epm', applications: [] });

            const res = await call('POST', '/events/' + event.id + '/votings', generator.generateVoting());

            expect(res.statusCode).toEqual(400);
            expect(res.body.success).toEqual(false);
        });

        test('should fail when the user is not authenticated', async () => {
            mock.mockAll({ core: { unauthorized: true } });
            const event = await generator.createEvent({ type: 'agora', applications: [] });

            const res = await call('POST', '/events/' + event.id + '/votings', generator.generateVoting());

            expect(res.statusCode).toEqual(401);
        });
    });

    describe('listing and displaying', () => {
        test('should list all votings of the event for the JC, including drafts', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const otherEvent = await generator.createEvent({ type: 'agora', applications: [] });
            await generator.createVoting({ status: 'draft' }, event);
            await generator.createVoting({ status: 'open' }, event);
            await generator.createVoting({ status: 'closed', result: 'accepted' }, event);
            await generator.createVoting({}, otherEvent);

            const res = await call('GET', '/events/' + event.id + '/votings');

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.map((voting) => voting.status)).toEqual(['draft', 'open', 'closed']);
        });

        test('should hide drafts from users who cannot manage votings', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const draft = await generator.createVoting({ status: 'draft' }, event);
            await generator.createVoting({ status: 'open' }, event);

            const listRes = await call('GET', '/events/' + event.id + '/votings');
            expect(listRes.statusCode).toEqual(200);
            expect(listRes.body.data.map((voting) => voting.status)).toEqual(['open']);

            const singleRes = await call('GET', '/events/' + event.id + '/votings/' + draft.id);
            expect(singleRes.statusCode).toEqual(404);
        });

        test('should display a single voting', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const voting = await generator.createVoting({ title: 'Activity Plan' }, event);

            const res = await call('GET', '/events/' + event.id + '/votings/' + voting.id);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.id).toEqual(voting.id);
            expect(res.body.data.title).toEqual('Activity Plan');
        });

        test('should find the event by its URL', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const voting = await generator.createVoting({}, event);

            const res = await call('GET', '/events/' + event.url + '/votings/' + voting.id);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.id).toEqual(voting.id);
        });

        test('should return 404 for a voting of another event', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const otherEvent = await generator.createEvent({ type: 'agora', applications: [] });
            const voting = await generator.createVoting({}, otherEvent);

            const res = await call('GET', '/events/' + event.id + '/votings/' + voting.id);

            expect(res.statusCode).toEqual(404);
        });

        test('should return 400 for an invalid voting ID', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });

            const res = await call('GET', '/events/' + event.id + '/votings/abc');

            expect(res.statusCode).toEqual(400);
        });
    });

    describe('editing and deleting', () => {
        test('should edit a draft voting', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const voting = await generator.createVoting({ title: 'Old title', majority: 'simple' }, event);

            const res = await call('PUT', '/events/' + event.id + '/votings/' + voting.id, { title: 'New title', status: 'closed' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.title).toEqual('New title');
            expect(res.body.data.majority).toEqual('simple');
            expect(res.body.data.status).toEqual('draft');
        });

        test('should not edit a voting that is open', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const voting = await generator.createVoting({ status: 'open', title: 'Old title' }, event);

            const res = await call('PUT', '/events/' + event.id + '/votings/' + voting.id, { title: 'New title' });

            expect(res.statusCode).toEqual(409);
            await voting.reload();
            expect(voting.title).toEqual('Old title');
        });

        test('should not edit without the permission', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const voting = await generator.createVoting({ status: 'open' }, event);

            const res = await call('PUT', '/events/' + event.id + '/votings/' + voting.id, { title: 'New title' });

            expect(res.statusCode).toEqual(403);
        });

        test('should delete a draft voting', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const voting = await generator.createVoting({}, event);

            const res = await call('DELETE', '/events/' + event.id + '/votings/' + voting.id);

            expect(res.statusCode).toEqual(200);
            expect(await Voting.findByPk(voting.id)).toEqual(null);
        });

        test('should not delete a voting that is closed', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const voting = await generator.createVoting({ status: 'closed', result: 'rejected' }, event);

            const res = await call('DELETE', '/events/' + event.id + '/votings/' + voting.id);

            expect(res.statusCode).toEqual(409);
            expect(await Voting.findByPk(voting.id)).not.toEqual(null);
        });

        test('should not delete without the permission', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const voting = await generator.createVoting({ status: 'open' }, event);

            const res = await call('DELETE', '/events/' + event.id + '/votings/' + voting.id);

            expect(res.statusCode).toEqual(403);
        });
    });
});
