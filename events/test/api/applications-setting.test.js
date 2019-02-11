const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Application } = require('../../models');
const user = require('../assets/oms-core-valid').data;

describe('Events application create/update', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();

        await generator.clearAll();
    });


    it('should disallow application for events with closed deadline', async () => {
        const event = await generator.createEvent({
            application_starts: moment().subtract(2, 'weeks').toDate(),
            application_ends: moment().subtract(1, 'week').toDate(),
            status: 'published',
            questions: []
        });

        const res = await request({
            uri: '/single/' + event.id + '/applications/mine',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'PUT',
            body: { body_id: user.bodies[0].id }
        });

        expect(res.statusCode).toEqual(403);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should update application if it already exists', async () => {
        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            questions: [{
                type: 'string',
                name: 'test',
                description: 'test',
                required: true
            }]
        });
        const application = await generator.createApplication({
            user_id: user.id,
            body_id: user.bodies[0].id,
            answers: ['first']
        }, event);

        const res = await request({
            uri: '/single/' + event.id + '/applications/mine',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'PUT',
            body: { answers: ['second'] }
        });

        expect(res.statusCode).toEqual(200);

        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('message');

        const applicationFromDb = await Application.findByPk(application.id);
        expect(applicationFromDb.answers[0]).toEqual('second');
    });

    it('should not add the application if the person is not a member of a body', async () => {
        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            questions: [{
                type: 'string',
                name: 'test',
                description: 'test',
                required: true
            }]
        });

        const res = await request({
            uri: '/single/' + event.id + '/applications/mine',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'PUT',
            body: {
                body_id: 1337,
                answers: ['test']
            }
        });

        expect(res.statusCode).toEqual(400);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should add the application if it doesn\'t exists', async () => {
        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            questions: [{
                type: 'string',
                name: 'test',
                description: 'test',
                required: true
            }]
        });

        const res = await request({
            uri: '/single/' + event.id + '/applications/mine',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'PUT',
            body: {
                body_id: user.bodies[0].id,
                answers: ['test']
            }
        });

        expect(res.statusCode).toEqual(200);

        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('message');

        const applicationFromDb = await Application.findOne({ where: { event_id: event.id, user_id: user.id } });
        expect(applicationFromDb.user_id).toEqual(user.id);
        expect(applicationFromDb.body_id).toEqual(user.bodies[0].id);
        expect(applicationFromDb.answers[0]).toEqual('test');
    });
});
