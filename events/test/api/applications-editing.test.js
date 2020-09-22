const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Application } = require('../../models');
const user = require('../assets/oms-core-valid').data;

describe('Events application editing', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();

        await generator.clearAll();
    });

    it('should disallow editing your application for events with closed deadline', async () => {
        mock.mockAll(({ mainPermissions: { noPermissions: true } }));

        const event = await generator.createEvent({
            application_starts: moment().subtract(2, 'weeks').toDate(),
            application_ends: moment().subtract(1, 'week').toDate(),
            status: 'published',
            questions: [],
            applications: [],
            organizers: [{
                user_id: 1337,
                first_name: 'first',
                last_name: 'second'
            }]
        });

        await generator.createApplication({ user_id: user.id }, event);

        const res = await request({
            uri: '/single/' + event.id + '/applications/me',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'PUT',
            body: { body_id: user.bodies[0].id }
        });

        expect(res.statusCode).toEqual(403);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should update other application if you have global permissions', async () => {
        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            organizers: [{
                user_id: 1234,
                first_name: 'test',
                last_name: 'test'
            }],
            questions: [{
                type: 'number',
                description: 'test',
                required: true
            }]
        });

        const application = await generator.createApplication({
            user_id: 1337,
            body_id: user.bodies[0].id,
            answers: [1]
        }, event);

        const res = await request({
            uri: '/single/' + event.id + '/applications/' + application.id,
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'PUT',
            body: { answers: [2] }
        });

        expect(res.statusCode).toEqual(200);

        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('message');

        const applicationFromDb = await Application.findByPk(application.id);
        expect(applicationFromDb.answers[0]).toEqual(2);
    });

    it('should update your application if you do not have global permissions', async () => {
        mock.mockAll(({ mainPermissions: { noPermissions: true } }));

        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            organizers: [{
                user_id: 1234,
                first_name: 'test',
                last_name: 'test'
            }],
            questions: [{
                type: 'number',
                description: 'test',
                required: true
            }]
        });
        const application = await generator.createApplication({
            user_id: user.id,
            body_id: user.bodies[0].id,
            answers: [1]
        }, event);

        const res = await request({
            uri: '/single/' + event.id + '/applications/me',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'PUT',
            body: { answers: [2] }
        });

        expect(res.statusCode).toEqual(200);

        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('message');

        const applicationFromDb = await Application.findByPk(application.id);
        expect(applicationFromDb.answers[0]).toEqual(2);
    });

    it('should update the application body if provided', async () => {
        mock.mockAll(({ mainPermissions: { noPermissions: true } }));

        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            organizers: [{
                user_id: 1234,
                first_name: 'test',
                last_name: 'test'
            }],
            questions: [{
                type: 'number',
                description: 'test',
                required: true
            }]
        });
        const application = await generator.createApplication({
            user_id: user.id,
            body_id: user.bodies[0].id,
            answers: [1]
        }, event);

        const res = await request({
            uri: '/single/' + event.id + '/applications/me',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'PUT',
            body: { body_id: user.bodies[1].id }
        });

        expect(res.statusCode).toEqual(200);

        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('message');

        const applicationFromDb = await Application.findByPk(application.id);
        expect(applicationFromDb.body_id).toEqual(user.bodies[1].id);
    });

    it('should fail if body_id is not provided, but user is not a member', async () => {
        mock.mockAll(({ mainPermissions: { noPermissions: true } }));

        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            organizers: [{
                user_id: 1234,
                first_name: 'test',
                last_name: 'test'
            }],
            questions: [{
                type: 'number',
                description: 'test',
                required: true
            }]
        });

        await generator.createApplication({
            user_id: user.id,
            body_id: user.bodies[0].id,
            answers: [1]
        }, event);

        const res = await request({
            uri: '/single/' + event.id + '/applications/me',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'PUT',
            body: { body_id: 1337 }
        });

        expect(res.statusCode).toEqual(403);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });
});
