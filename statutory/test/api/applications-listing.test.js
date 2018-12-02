const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');

describe('Applications listing', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        await generator.clearAll()
        mock.cleanAll();
    });

    test('should display everything if the user has permissions on /all', async () => {
        const event = await generator.createEvent();

        const res = await request({
            uri: '/events/' + event.id + '/applications/all',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        const applicationIds = event.applications.map(a => a.id);
        expect(res.body.data.length).toEqual(applicationIds.length);

        for (const application of res.body.data) {
            expect(applicationIds).toContain(application.id);
        }
    });

    test('should result in an error if user does not have permission on /all', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });
        const event = await generator.createEvent();

        const res = await request({
            uri: '/events/' + event.id + '/applications/all',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should display accepted application on /accepted', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });
        const event = await generator.createEvent();
        const application = await generator.createApplication({ status: 'accepted' }, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/accepted',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(application.id);

        expect(res.body.data[0]).not.toHaveProperty('board_comment');
        expect(res.body.data[0]).not.toHaveProperty('answers');
        expect(res.body.data[0]).not.toHaveProperty('visa_required');
        expect(res.body.data[0]).not.toHaveProperty('status');
    });

    test('should not display not accepted application on /accepted', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });
        const event = await generator.createEvent();
        await generator.createApplication({ status: 'pending' }, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/accepted',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(0);
    });

    test('should sort accepted application on /accepted', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });
        const event = await generator.createEvent();
        const applications = [];

        for (let i = 0; i < 5; i++) {
            applications.push(await generator.createApplication({ user_id: i, status: 'accepted' }, event));
        }

        const res = await request({
            uri: '/events/' + event.id + '/applications/accepted',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(applications.length);

        const sortedIds = applications.map(a => a.id).sort((a, b) => b - a);
        for (let index = 0; index < applications.length; index++) {
            expect(res.body.data[index].id).toEqual(sortedIds[index]);
        }
    });

    test('should sort accepted application on /all', async () => {
        const event = await generator.createEvent();
        const applications = [];

        for (let i = 0; i < 5; i++) {
            applications.push(await generator.createApplication({ user_id: i }, event));
        }

        const res = await request({
            uri: '/events/' + event.id + '/applications/all',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(applications.length);

        const sortedIds = applications.map(a => a.id).sort((a, b) => b - a);
        for (let index = 0; index < applications.length; index++) {
            expect(res.body.data[index].id).toEqual(sortedIds[index]);
        }
    });
});
