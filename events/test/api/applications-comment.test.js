const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Application } = require('../../models');
const user = require('../assets/oms-core-valid').data;

describe('Events application comments', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();

        await generator.clearAll();
    });

    it('should disallow changing comment if you don\'t have rights for it', async () => {
        mock.mockAll({ approvePermissions: { noPermissions: true } });

        const event = await generator.createEvent();
        const application = await generator.createApplication({}, event);

        const res = await request({
            uri: '/single/' + event.id + '/applications/' + application.id + '/comment',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'PUT',
            body: { board_comment: 'Not good.' }
        });

        expect(res.statusCode).toEqual(403);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should disallow changing status if the application is not found', async () => {
        mock.mockAll({ approvePermissions: { noPermissions: true } });

        const event = await generator.createEvent();
        await generator.createApplication({}, event);

        const res = await request({
            uri: '/single/' + event.id + '/applications/1337/comment',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'PUT',
            body: { board_comment: 'Not good.' }
        });

        expect(res.statusCode).toEqual(404);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should allow changing status if everything is okay', async () => {
        const event = await generator.createEvent();
        const application = await generator.createApplication({
            body_id: user.bodies[0].id,
            board_comment: 'Awesome person.'
        }, event);

        const res = await request({
            uri: '/single/' + event.id + '/applications/' + application.id + '/comment',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'PUT',
            body: { board_comment: 'Not good.' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');

        const applicationFromDb = await Application.findByPk(application.id);
        expect(applicationFromDb.board_comment).toEqual('Not good.');
    });
});
