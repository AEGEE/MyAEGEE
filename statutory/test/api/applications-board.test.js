const tk = require('timekeeper');
const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/oms-core-valid').data;

describe('Applications pax type/board comment', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();
    });

    test('should not succeed for current user', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent();
        const application = await generator.createApplication({ user_id: regularUser.id }, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/me/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: 'delegate' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed when the permissions are okay', async () => {
        const event = await generator.createEvent();
        const application = await generator.createApplication({
            body_id: regularUser.bodies[0].id
        }, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: 'delegate', board_comment: 'test' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.id).toEqual(application.id);
        expect(res.body.data.participant_type).toEqual('delegate');
        expect(res.body.data.board_comment).toEqual('test');
    });

    test('should return 403 when user does not have permissions', async () => {
        mock.mockAll({ approvePermissions: { noPermissions: true }, mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent();
        const application = await generator.createApplication({}, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: 'delegate' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 404 if the application is not found', async () => {
        const event = await generator.createEvent({ applications: [] });

        const res = await request({
            uri: '/events/' + event.id + '/applications/333/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: 'delegate' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 400 on malformed user_id', async () => {
        const event = await generator.createEvent({ applications: [] });

        const res = await request({
            uri: '/events/' + event.id + '/applications/lalala/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: 'delegate' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 422 if info is invalid', async () => {
        const event = await generator.createEvent();
        const application = await generator.createApplication({
            body_id: regularUser.bodies[0].id
        }, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { participant_type: 'invalid' }
        });


        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should succeed and update nothing when the body is empty', async () => {
        const event = await generator.createEvent();
        const application = await generator.createApplication({
            body_id: regularUser.bodies[0].id
        }, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/' + application.id + '/board',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {}
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.id).toEqual(application.id);
        expect(res.body.data.participant_type).toEqual(application.participant_type);
        expect(res.body.data.board_comment).toEqual(application.board_comment);
    });

    test('should return 403 if the user is not within deadline and doesn\'t have global permission', async () => {
      mock.mockAll({ mainPermissions: { noPermissions: true } });

      const event = await generator.createEvent();
      const application = await generator.createApplication({}, event);

      tk.travel(moment(event.board_approve_deadline).add(5, 'minutes').toDate());

      const res = await request({
          uri: '/events/' + event.id + '/applications/' + application.id + '/board',
          method: 'PUT',
          headers: { 'X-Auth-Token': 'blablabla' },
          body: { participant_type: 'delegate' }
      });

      expect(res.statusCode).toEqual(403);
      expect(res.body.success).toEqual(false);
      expect(res.body).not.toHaveProperty('data');
      expect(res.body).toHaveProperty('message');
  });
});
