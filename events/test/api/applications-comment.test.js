const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Application } = require('../../models');
const user = require('../assets/oms-core-valid.json').data;

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

    const putComment = (event, application, body) => request({
        path: '/single/' + event.id + '/applications/' + application.id + '/comment',
        headers: { 'X-Auth-Token': 'foobar' },
        method: 'PUT',
        body
    });

    it('should not let the board of another body comment', async () => {
        // The mocked board rights are for body 34 (user.bodies[0]); the application is for body 9.
        const event = await generator.createEvent();
        const application = await generator.createApplication(event, { body_id: user.bodies[1].id });

        const res = await putComment(event, application, { board_comment: 'Not ours.' });

        expect(res.statusCode).toEqual(403);
        expect((await Application.findByPk(application.id)).board_comment).toEqual(null);
    });

    it('should let the board remove its comment', async () => {
        const event = await generator.createEvent();
        const application = await generator.createApplication(event, { body_id: user.bodies[0].id, board_comment: 'Old comment' });

        const res = await putComment(event, application, { board_comment: null });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.board_comment).toEqual(null);
    });

    it('should disallow changing comment if you don\'t have rights for it', async () => {
        mock.mockAll({ approvePermissions: { noPermissions: true } });

        const event = await generator.createEvent();
        const application = await generator.createApplication(event);

        const res = await request({
            path: '/single/' + event.id + '/applications/' + application.id + '/comment',
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
        await generator.createApplication(event);

        const res = await request({
            path: '/single/' + event.id + '/applications/1337/comment',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'PUT',
            body: { board_comment: 'Not good.' }
        });

        expect(res.statusCode).toEqual(404);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should return 400 if the application ID is not a number', async () => {
        mock.mockAll({ approvePermissions: { noPermissions: true } });

        const event = await generator.createEvent();
        await generator.createApplication(event);

        const res = await request({
            path: '/single/' + event.id + '/applications/false/comment',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'PUT',
            body: { board_comment: 'Not good.' }
        });

        expect(res.statusCode).toEqual(400);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should return 400 if the application ID is not an integer', async () => {
        const event = await generator.createEvent();
        const application = await generator.createApplication(event, { body_id: user.bodies[0].id });

        const res = await request({
            path: '/single/' + event.id + '/applications/' + application.id + '.0/comment',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'PUT',
            body: { board_comment: 'Not good.' }
        });

        expect(res.statusCode).toEqual(400);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should return 400 if the application ID is above the maximum ID', async () => {
        const event = await generator.createEvent();

        const res = await request({
            path: '/single/' + event.id + '/applications/2147483648/comment',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'PUT',
            body: { board_comment: 'Not good.' }
        });

        expect(res.statusCode).toEqual(400);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should allow changing status if everything is okay', async () => {
        const event = await generator.createEvent();
        const application = await generator.createApplication(event, {
            body_id: user.bodies[0].id,
            board_comment: 'Awesome person.'
        });

        const res = await request({
            path: '/single/' + event.id + '/applications/' + application.id + '/comment',
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
