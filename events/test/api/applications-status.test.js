const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Application } = require('../../models');

describe('Events application status', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();

        await generator.clearAll();
    });

    it('should disallow changing status if you don\'t have rights for it', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });
        const event = await generator.createEvent({
            organizers: [{ first_name: 'test', last_name: 'test', user_id: 1337 }]
        });
        const application = await generator.createApplication({}, event);

        const res = await request({
            uri: '/single/' + event.id + '/applications/' + application.id + '/status',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'PUT',
            body: { status: 'accepted' }
        });

        expect(res.statusCode).toEqual(403);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should disallow changing status if applications is not found', async () => {
        const event = await generator.createEvent({
            organizers: [{ first_name: 'test', last_name: 'test', user_id: 1337 }]
        });

        const res = await request({
            uri: '/single/' + event.id + '/applications/1337/status',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'PUT',
            body: { status: 'acceptedd' }
        });

        expect(res.statusCode).toEqual(404);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should allow changing status if everything is okay', async () => {
        const event = await generator.createEvent();
        const application = await generator.createApplication({}, event);

        const res = await request({
            uri: '/single/' + event.id + '/applications/' + application.id + '/status',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'PUT',
            body: { status: 'accepted' }
        });

        expect(res.statusCode).toEqual(200);

        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');

        const applicationFromDb = await Application.findByPk(application.id);
        expect(applicationFromDb.status).toEqual('accepted');
    });
});
