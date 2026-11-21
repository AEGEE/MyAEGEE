const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Application } = require('../../models');
const user = require('../assets/oms-core-valid.json').data;

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

        await generator.createApplication(event, { user_id: user.id });

        const res = await request({
            path: '/single/' + event.id + '/applications/me',
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

        const application = await generator.createApplication(event, {
            user_id: 1337,
            body_id: user.bodies[0].id,
            answers: [1]
        });

        const res = await request({
            path: '/single/' + event.id + '/applications/' + application.id,
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
        const application = await generator.createApplication(event, {
            user_id: user.id,
            body_id: user.bodies[0].id,
            answers: [1]
        });

        const res = await request({
            path: '/single/' + event.id + '/applications/me',
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
        const application = await generator.createApplication(event, {
            user_id: user.id,
            body_id: user.bodies[0].id,
            answers: [1]
        });

        const res = await request({
            path: '/single/' + event.id + '/applications/me',
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

        await generator.createApplication(event, {
            user_id: user.id,
            body_id: user.bodies[0].id,
            answers: [1]
        });

        const res = await request({
            path: '/single/' + event.id + '/applications/me',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'PUT',
            body: { body_id: 1337 }
        });

        expect(res.statusCode).toEqual(403);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should keep the applicant when someone else edits the application', async () => {
        mock.mockAll({ member: { bodies: user.bodies } });

        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            organizers: [{ user_id: 1234, first_name: 'test', last_name: 'test' }],
            questions: []
        });

        const application = await generator.createApplication(event, {
            user_id: 1337,
            body_id: user.bodies[0].id,
            answers: []
        });

        const res = await request({
            path: '/single/' + event.id + '/applications/' + application.id,
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'PUT',
            body: { body_id: user.bodies[1].id, answers: [] }
        });

        expect(res.statusCode).toEqual(200);

        const applicationFromDb = await Application.findByPk(application.id);
        expect(applicationFromDb.user_id).toEqual(1337);
        expect(applicationFromDb.first_name).toEqual('Member1337');
        expect(applicationFromDb.body_id).toEqual(user.bodies[1].id);
    });

    it('should not allow changing the application to a body the applicant is not a member of', async () => {
        mock.mockAll({ member: { bodies: [user.bodies[0]] } });

        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            organizers: [{ user_id: 1234, first_name: 'test', last_name: 'test' }],
            questions: []
        });

        const application = await generator.createApplication(event, {
            user_id: 1337,
            body_id: user.bodies[0].id,
            answers: []
        });

        // The editor is a member of this body, the applicant isn't.
        const res = await request({
            path: '/single/' + event.id + '/applications/' + application.id,
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'PUT',
            body: { body_id: user.bodies[1].id, answers: [] }
        });

        expect(res.statusCode).toEqual(403);
        const applicationFromDb = await Application.findByPk(application.id);
        expect(applicationFromDb.body_id).toEqual(user.bodies[0].id);
    });

    it('should ignore the fields the applicant cannot set when editing their application', async () => {
        mock.mockAll(({ mainPermissions: { noPermissions: true } }));

        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            organizers: [{ user_id: 1234, first_name: 'test', last_name: 'test' }],
            questions: []
        });
        const application = await generator.createApplication(event, {
            user_id: user.id,
            body_id: user.bodies[0].id,
            body_name: user.bodies[0].name,
            answers: []
        });

        const res = await request({
            path: '/single/' + event.id + '/applications/me',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'PUT',
            body: {
                status: 'accepted',
                board_comment: 'Great!',
                confirmed: true,
                attended: true,
                body_name: 'Fake body'
            }
        });

        expect(res.statusCode).toEqual(200);

        const applicationFromDb = await Application.findByPk(application.id);
        expect(applicationFromDb.status).toEqual('pending');
        expect(applicationFromDb.board_comment).toEqual(null);
        expect(applicationFromDb.confirmed).toEqual(false);
        expect(applicationFromDb.attended).toEqual(false);
        expect(applicationFromDb.body_name).toEqual(user.bodies[0].name);
    });

    it('should let someone else edit the application of an applicant who left the body they applied with', async () => {
        // The applicant is no longer a member of the body the application is for.
        mock.mockAll({ member: { bodies: [user.bodies[1]] } });

        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            organizers: [{ user_id: 1234, first_name: 'test', last_name: 'test' }],
            questions: [{ type: 'string', description: 'test', required: true }]
        });

        const application = await generator.createApplication(event, {
            user_id: 1337,
            body_id: user.bodies[0].id,
            body_name: user.bodies[0].name,
            answers: ['old']
        });

        // The form sends the whole application back, including the current body (as a string here).
        const res = await request({
            path: '/single/' + event.id + '/applications/' + application.id,
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'PUT',
            body: { body_id: String(user.bodies[0].id), answers: ['new'] }
        });

        expect(res.statusCode).toEqual(200);
        const applicationFromDb = await Application.findByPk(application.id);
        expect(applicationFromDb.body_id).toEqual(user.bodies[0].id);
        expect(applicationFromDb.body_name).toEqual(user.bodies[0].name);
        expect(applicationFromDb.answers).toEqual(['new']);
    });
});
