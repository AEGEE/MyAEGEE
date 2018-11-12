const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/oms-core-valid').data;

describe('Memberslist listing', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        await generator.clearAll();
        mock.cleanAll();
    });

    test('should fail if user has no permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent();
        await generator.createMembersList({ body_id: regularUser.bodies[0].id }, event);

        const res = await request({
            uri: '/events/' + event.id + '/memberslists/',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should succeed if user has permission', async () => {
        mock.mockAll({ approvePermissions: { noPermissions: true } });

        const event = await generator.createEvent();
        await generator.createMembersList({ body_id: 1337 }, event);
        const res = await request({
            uri: '/events/' + event.id + '/memberslists/',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].body_id).toEqual(1337);
    });
});
