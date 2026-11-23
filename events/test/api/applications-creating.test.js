const moment = require('moment');
const tk = require('timekeeper');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Application } = require('../../models');
const user = require('../assets/oms-core-valid.json').data;
const callers = require('../scripts/callers');

describe('Events application creating', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();

        await generator.clearAll();
    });

    // A published event whose application period is open.
    const openEvent = (fields = {}) => generator.createEvent({
        application_starts: moment().subtract(1, 'week').toDate(),
        application_ends: moment().add(1, 'week').toDate(),
        status: 'published',
        questions: [],
        ...fields
    });
    const apply = (event, body = { body_id: user.bodies[0].id, answers: [], agreed_to_privacy_policy: true }) => request({
        path: '/single/' + event.id + '/applications',
        headers: { 'X-Auth-Token': 'foobar' },
        method: 'POST',
        body
    });

    it('should create the application with 200 and mail the applicant', async () => {
        const mails = mock.captureMails(mock.mockAll().omsMailerStub);
        const event = await openEvent();

        const res = await apply(event);

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.user_id).toEqual(user.id);
        expect(res.body.data.body_id).toEqual(user.bodies[0].id);
        expect(res.body.data.status).toEqual('pending');
        expect(mails).toHaveLength(1);
        expect(mails[0].template).toEqual('events_applied.html');
        expect(mails[0].to).toEqual(user.notification_email);
        expect(mails[0].parameters.event.id).toEqual(event.id);
    });

    it('should not keep the application if the mail cannot be sent', async () => {
        mock.mockAll({ mailer: { netError: true } });
        const event = await openEvent();

        const res = await apply(event);

        expect(res.statusCode).toEqual(500);
        expect(await Application.count()).toEqual(0);
    });

    it('should return 422 if the member applied to the event already', async () => {
        const event = await openEvent();
        await generator.createApplication(event, { user_id: user.id, body_id: user.bodies[0].id, answers: [] });

        const res = await apply(event);

        expect(res.statusCode).toEqual(422);
        expect(res.body.errors).toHaveProperty('user_id');
        expect(await Application.count()).toEqual(1);
    });

    test.each(['draft', 'submitted'])('should disallow applications to a %s event with an open application period', async (status) => {
        const event = await openEvent({ status });

        const res = await apply(event);

        expect(res.statusCode).toEqual(403);
        expect(await Application.count()).toEqual(0);
    });

    it('should disallow applications before the application period starts', async () => {
        const event = await openEvent({ application_starts: moment().add(1, 'day').toDate(), application_ends: moment().add(1, 'week').toDate() });

        const res = await apply(event);

        expect(res.statusCode).toEqual(403);
    });

    it('should accept applications at the moment the application period ends, and not after', async () => {
        const event = await openEvent();
        try {
            tk.freeze(event.application_ends);
            expect((await apply(event)).statusCode).toEqual(200);

            await Application.destroy({ where: {} });
            tk.freeze(new Date(event.application_ends.getTime() + 1));
            expect((await apply(event)).statusCode).toEqual(403);
        } finally {
            tk.reset();
        }
    });

    it('should accept applications from a member whose ban has ended', async () => {
        callers.asSuperadminWith({ event_application_ban: { ban_until: moment().subtract(1, 'day').toDate() } });
        const event = await openEvent();

        const res = await apply(event);

        expect(res.statusCode).toEqual(200);
    });

    it('should return 422 if core gives a first name longer than its column', async () => {
        callers.asSuperadminWith({ first_name: 'a'.repeat(256) });
        const event = await openEvent();

        const res = await apply(event);

        expect(res.statusCode).toEqual(422);
        expect(res.body.errors).toHaveProperty('first_name');
    });

    it('should return 422 if core has no first name for the applicant', async () => {
        callers.asSuperadminWith({ first_name: '' });
        const event = await openEvent();

        const res = await apply(event);

        expect(res.statusCode).toEqual(422);
        expect(res.body.errors).toHaveProperty('first_name');
    });

    it('should disallow application when user has an active event application ban', async () => {
        mock.mockAll({ core: { eventApplicationBanned: true } });

        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            applications: [],
            questions: []
        });

        const res = await request({
            path: '/single/' + event.id + '/applications',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: {
                body_id: user.bodies[0].id,
                answers: [],
                agreed_to_privacy_policy: true
            }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should disallow application for events with closed deadline', async () => {
        const event = await generator.createEvent({
            application_starts: moment().subtract(2, 'weeks').toDate(),
            application_ends: moment().subtract(1, 'week').toDate(),
            status: 'published',
            questions: [],
            applications: []
        });

        const res = await request({
            path: '/single/' + event.id + '/applications',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: { body_id: user.bodies[0].id }
        });

        expect(res.statusCode).toEqual(403);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should not accept applications to a deleted event', async () => {
        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            deleted: true,
            questions: [],
            applications: []
        });

        const res = await request({
            path: '/single/' + event.id + '/applications',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: {
                body_id: user.bodies[0].id,
                answers: [],
                agreed_to_privacy_policy: true
            }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(await Application.count({ where: { event_id: event.id } })).toEqual(0);
    });

    it('should disallow application for online events without application process', async () => {
        const event = await generator.createEvent({
            status: 'published',
            method: 'online',
            has_applications: false
        });

        const res = await request({
            path: '/single/' + event.id + '/applications',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: { body_id: user.bodies[0].id }
        });

        expect(res.statusCode).toEqual(403);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should not add the application if the person is not a member of a body', async () => {
        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            applications: [],
            questions: [{
                type: 'string',
                name: 'test',
                description: 'test',
                required: true
            }]
        });

        const res = await request({
            path: '/single/' + event.id + '/applications',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: {
                body_id: 1337,
                answers: ['test'],
                agreed_to_privacy_policy: true
            }
        });

        expect(res.statusCode).toEqual(400);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should return 422 if agreed_to_privacy_policy = false', async () => {
        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            applications: [],
            questions: []
        });

        const res = await request({
            path: '/single/' + event.id + '/applications',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: {
                body_id: user.bodies[0].id,
                answers: [],
                agreed_to_privacy_policy: false
            }
        });

        expect(res.statusCode).toEqual(422);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('agreed_to_privacy_policy');
    });

    it('should return 422 if answers is not an array', async () => {
        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            applications: [],
            questions: [{
                type: 'checkbox',
                description: 'test',
                required: true
            }]
        });

        const res = await request({
            path: '/single/' + event.id + '/applications',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: {
                body_id: user.bodies[0].id,
                answers: false,
                agreed_to_privacy_policy: true
            }
        });

        expect(res.statusCode).toEqual(422);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('answers');
    });

    it('should return 422 if answer number mismatch questions number', async () => {
        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            questions: [{
                type: 'checkbox',
                description: 'test',
                required: true
            }]
        });

        const res = await request({
            path: '/single/' + event.id + '/applications',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: {
                body_id: user.bodies[0].id,
                answers: [],
                agreed_to_privacy_policy: true
            }
        });

        expect(res.statusCode).toEqual(422);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('answers');
    });

    it('should return 422 if question.type = string, but answer is not a string', async () => {
        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            questions: [{
                type: 'string',
                description: 'test',
                required: true
            }]
        });

        const res = await request({
            path: '/single/' + event.id + '/applications',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: {
                body_id: user.bodies[0].id,
                answers: [false],
                agreed_to_privacy_policy: true
            }
        });

        expect(res.statusCode).toEqual(422);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('answers');
    });

    it('should return 422 if question.type = text, but answer is not a string', async () => {
        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            questions: [{
                type: 'text',
                description: 'test',
                required: true
            }]
        });

        const res = await request({
            path: '/single/' + event.id + '/applications',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: {
                body_id: user.bodies[0].id,
                answers: [false],
                agreed_to_privacy_policy: true
            }
        });

        expect(res.statusCode).toEqual(422);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('answers');
    });

    it('should return 422 if question.type = string, but answer is empty', async () => {
        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            questions: [{
                type: 'string',
                description: 'test',
                required: true
            }]
        });

        const res = await request({
            path: '/single/' + event.id + '/applications',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: {
                body_id: user.bodies[0].id,
                answers: [''],
                agreed_to_privacy_policy: true
            }
        });

        expect(res.statusCode).toEqual(422);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('answers');
    });

    it('should return 422 if question.type = text, but answer is not a string', async () => {
        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            questions: [{
                type: 'text',
                description: 'test',
                required: true
            }]
        });

        const res = await request({
            path: '/single/' + event.id + '/applications',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: {
                body_id: user.bodies[0].id,
                answers: [''],
                agreed_to_privacy_policy: true
            }
        });

        expect(res.statusCode).toEqual(422);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('answers');
    });

    it('should return 422 if question.type = number, but answer is not a number', async () => {
        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            questions: [{
                type: 'number',
                description: 'test',
                required: true
            }]
        });

        const res = await request({
            path: '/single/' + event.id + '/applications',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: {
                body_id: user.bodies[0].id,
                answers: [false],
                agreed_to_privacy_policy: true
            }
        });

        expect(res.statusCode).toEqual(422);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('answers');
    });

    it('should return 200 if question.type = number, but answer is a number', async () => {
        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            questions: [{
                type: 'number',
                description: 'test',
                required: true
            }]
        });

        const res = await request({
            path: '/single/' + event.id + '/applications',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: {
                body_id: user.bodies[0].id,
                answers: [1],
                agreed_to_privacy_policy: true
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('answers');
    });

    it('should return 422 if question.type = select, but answer is not in values', async () => {
        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            questions: [{
                type: 'select',
                description: 'test',
                required: true,
                values: ['first']
            }]
        });

        const res = await request({
            path: '/single/' + event.id + '/applications',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: {
                body_id: user.bodies[0].id,
                answers: ['second'],
                agreed_to_privacy_policy: true
            }
        });

        expect(res.statusCode).toEqual(422);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('answers');
    });

    it('should return 200 if question.type = select, but answer is in values', async () => {
        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            questions: [{
                type: 'select',
                description: 'test',
                required: true,
                values: ['first', 'second']
            }]
        });

        const res = await request({
            path: '/single/' + event.id + '/applications',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: {
                body_id: user.bodies[0].id,
                answers: ['first'],
                agreed_to_privacy_policy: true
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('answers');
    });

    it('should return 422 if question.type = checkbox, but answer is not a boolean', async () => {
        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            questions: [{
                type: 'checkbox',
                description: 'test',
                required: true
            }]
        });

        const res = await request({
            path: '/single/' + event.id + '/applications',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: {
                body_id: user.bodies[0].id,
                answers: ['second'],
                agreed_to_privacy_policy: true
            }
        });

        expect(res.statusCode).toEqual(422);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('answers');
    });

    it('should return 422 if question.type = checkbox and is required, but answer is not true', async () => {
        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            questions: [{
                type: 'checkbox',
                description: 'test',
                required: true
            }]
        });

        const res = await request({
            path: '/single/' + event.id + '/applications',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: {
                body_id: user.bodies[0].id,
                answers: [false],
                agreed_to_privacy_policy: true
            }
        });

        expect(res.statusCode).toEqual(422);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('answers');
    });

    it('should return 200 if question.type = checkbox, but answer is boolean', async () => {
        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            questions: [{
                type: 'checkbox',
                description: 'test',
                required: true
            }]
        });

        const res = await request({
            path: '/single/' + event.id + '/applications',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: {
                body_id: user.bodies[0].id,
                answers: [true],
                agreed_to_privacy_policy: true
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('answers');
    });

    it('should ignore the fields the applicant cannot set when applying', async () => {
        mock.mockAll(({ mainPermissions: { noPermissions: true } }));

        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            applications: [],
            questions: []
        });

        const res = await request({
            path: '/single/' + event.id + '/applications',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: {
                body_id: user.bodies[0].id,
                answers: [],
                agreed_to_privacy_policy: true,
                status: 'accepted',
                board_comment: 'Great!',
                confirmed: true,
                attended: true,
                body_name: 'Fake body'
            }
        });

        expect(res.statusCode).toEqual(200);

        const applicationFromDb = await Application.findByPk(res.body.data.id);
        expect(applicationFromDb.status).toEqual('pending');
        expect(applicationFromDb.board_comment).toEqual(null);
        expect(applicationFromDb.confirmed).toEqual(false);
        expect(applicationFromDb.attended).toEqual(false);
        expect(applicationFromDb.body_name).toEqual(user.bodies[0].name);
    });
});
