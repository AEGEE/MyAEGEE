const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');

describe('Positions listing', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();
        await generator.clearAll();
    });

    test('should fail if not Agora', async () => {
        const event = await generator.createEvent({ type: 'epm', applications: [] });
        await generator.createPosition({}, event);

        const res = await request({
            uri: '/events/' + event.id + '/positions/',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should list all of the positions for this event', async () => {
        const firstEvent = await generator.createEvent({ type: 'agora', applications: [] });
        const firstPosition = await generator.createPosition({}, firstEvent);

        const secondEvent = await generator.createEvent({ type: 'agora', applications: [] });
        await generator.createPosition({}, secondEvent);

        const res = await request({
            uri: '/events/' + firstEvent.id + '/positions/',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(firstPosition.id);
    });

    test('should list all of the approved candidates on /accepted', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            candidates: [generator.generateCandidate({ status: 'approved' })]
        }, event);

        const res = await request({
            uri: '/events/' + event.id + '/positions/approved',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(position.id);
        expect(res.body.data[0].candidates.length).toEqual(1);
        expect(res.body.data[0].candidates[0]).toHaveProperty('first_name');
    });

    test('should indicate that there is unapproved application on /accepted', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            candidates: [generator.generateCandidate({ status: 'pending' })]
        }, event);

        const res = await request({
            uri: '/events/' + event.id + '/positions/approved',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(position.id);
        expect(res.body.data[0].candidates.length).toEqual(1);
        expect(res.body.data[0].candidates[0]).not.toHaveProperty('first_name');
    });


    test('should not list rejected applications on /accepted', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        await generator.createPosition({
            candidates: [generator.generateCandidate({ status: 'rejected' })]
        }, event);

        const res = await request({
            uri: '/events/' + event.id + '/positions/approved',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].candidates.length).toEqual(0);
    });

    test('should list all applications on /all', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        await generator.createPosition({
            candidates: [
                generator.generateCandidate({ status: 'rejected' }),
                generator.generateCandidate({ status: 'approved' }),
                generator.generateCandidate({ status: 'pending' })
            ]
        }, event);

        const res = await request({
            uri: '/events/' + event.id + '/positions/all',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].candidates.length).toEqual(3);
    });

    test('should return 403 if you don\'t have permissions on /all', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        await generator.createPosition({
            candidates: [
                generator.generateCandidate({ status: 'rejected' }),
                generator.generateCandidate({ status: 'approved' }),
                generator.generateCandidate({ status: 'pending' })
            ]
        }, event);

        const res = await request({
            uri: '/events/' + event.id + '/positions/all',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });
});
