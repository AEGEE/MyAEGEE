const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const user = require('../assets/oms-core-valid.json').data;

describe('Events application info', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();

        await generator.clearAll();
    });

    it('should return 404 if application is not found', async () => {
        const event = await generator.createEvent();

        const res = await request({
            uri: '/single/' + event.id + '/applications/me',
            headers: { 'X-Auth-Token': 'foobar' },
        });

        expect(res.statusCode).toEqual(404);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should return 403 when not having the global permission and trying to edit other application', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            organizers: [{
                user_id: 1234,
                first_name: 'test',
                last_name: 'test'
            }]
        });
        const application = await generator.createApplication({ user_id: 1337 }, event);

        const res = await request({
            uri: '/single/' + event.id + '/applications/' + application.id,
            headers: { 'X-Auth-Token': 'foobar' },
        });

        expect(res.statusCode).toEqual(403);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should display my application', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent();
        await generator.createApplication({ user_id: user.id }, event);

        const res = await request({
            uri: '/single/' + event.id + '/applications/me',
            headers: { 'X-Auth-Token': 'foobar' },
        });

        expect(res.statusCode).toEqual(200);

        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
    });

    it('should display other user application if have global permission', async () => {
        const event = await generator.createEvent();
        const application = await generator.createApplication({ user_id: user.id }, event);

        const res = await request({
            uri: '/single/' + event.id + '/applications/' + application.id,
            headers: { 'X-Auth-Token': 'foobar' },
        });

        expect(res.statusCode).toEqual(200);

        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
    });
});
