const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/oms-core-valid').data;
const { Position } = require('../../models');

describe('Candidates submission', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll();
    });

    afterEach(async () => {
        await generator.clearAll();
        mock.cleanAll();
    });

    test('should return 403 if the applications have not started', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().add(1, 'week').toDate(),
            ends: moment().add(2, 'week').toDate()
        }, event);
        const candidate = generator.generateCandidate({ body_id: regularUser.bodies[0].id });

        const res = await request({
            uri: '/events/' + event.id + '/positions/' + position.id + '/candidates',
            method: 'POST',
            body: candidate,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 403 if the applications deadline has passed', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().add(1, 'week').toDate(),
            ends: moment().add(2, 'week').toDate()
        }, event);
        const candidate = generator.generateCandidate({ body_id: regularUser.bodies[0].id });

        const res = await request({
            uri: '/events/' + event.id + '/positions/' + position.id + '/candidates',
            method: 'POST',
            body: candidate,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 404 if position is not found', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        await generator.createPosition({
            starts: moment().add(1, 'week').toDate(),
            ends: moment().add(2, 'week').toDate()
        }, event);
        const candidate = generator.generateCandidate({ body_id: regularUser.bodies[0].id });

        const res = await request({
            uri: '/events/' + event.id + '/positions/1337/candidates',
            method: 'POST',
            body: candidate,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should fail if positions ID is NaN', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        await generator.createPosition({
            starts: moment().add(1, 'week').toDate(),
            ends: moment().add(2, 'week').toDate()
        }, event);
        const candidate = generator.generateCandidate({ body_id: regularUser.bodies[0].id });

        const res = await request({
            uri: '/events/' + event.id + '/positions/false/candidates',
            method: 'POST',
            body: candidate,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should fail when applying on behalf of a random body', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().subtract(1, 'week').toDate(),
            ends: moment().add(1, 'week').toDate()
        }, event);
        const candidate = generator.generateCandidate({ body_id: 1337 });

        const res = await request({
            uri: '/events/' + event.id + '/positions/' + position.id + '/candidates',
            method: 'POST',
            body: candidate,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should fail if user applied already', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().subtract(1, 'week').toDate(),
            ends: moment().add(1, 'week').toDate(),
            places: 2,
            candidates: [
                generator.generateCandidate({ user_id: regularUser.id })
            ]
        }, event);
        const candidate = generator.generateCandidate({ body_id: regularUser.bodies[0].id });

        const res = await request({
            uri: '/events/' + event.id + '/positions/' + position.id + '/candidates',
            method: 'POST',
            body: candidate,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('user_id');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should succeed if the application is within the deadline', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().subtract(1, 'week').toDate(),
            ends: moment().add(1, 'week').toDate()
        }, event);
        const candidate = generator.generateCandidate({ body_id: regularUser.bodies[0].id });

        const res = await request({
            uri: '/events/' + event.id + '/positions/' + position.id + '/candidates',
            method: 'POST',
            body: candidate,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        const positionFromDb = await Position.findByPk(position.id);
        expect(positionFromDb.status).toEqual('open');
    });

    test('should succeed if the deadline has passed, but the position does not have enough places', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().subtract(2, 'week').toDate(),
            ends: moment().add(1, 'week').toDate(),
            places: 5
        }, event);
        const candidate = generator.generateCandidate({ body_id: regularUser.bodies[0].id });

        const res = await request({
            uri: '/events/' + event.id + '/positions/' + position.id + '/candidates',
            method: 'POST',
            body: candidate,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        const positionFromDb = await Position.findByPk(position.id);
        expect(positionFromDb.status).toEqual('open');
    });

    test('should not close the deadline if application period is open', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().subtract(1, 'week').toDate(),
            ends: moment().add(1, 'week').toDate(),
            places: 1,
            candidates: [
                generator.generateCandidate({ status: 'approved', user_id: 1337 })
            ]
        }, event);
        const candidate = generator.generateCandidate({ body_id: regularUser.bodies[0].id, user_id: regularUser.id });

        const res = await request({
            uri: '/events/' + event.id + '/positions/' + position.id + '/candidates',
            method: 'POST',
            body: candidate,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        const positionFromDb = await Position.findByPk(position.id);
        expect(positionFromDb.status).toEqual('open');
    });

    test('should close the deadline if application period is over', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().subtract(2, 'week').toDate(),
            ends: moment().subtract(1, 'week').toDate(),
            places: 1,
            candidates: [
                generator.generateCandidate({ status: 'approved' })
            ]
        }, event);
        const candidate = generator.generateCandidate({ body_id: regularUser.bodies[0].id });

        const res = await request({
            uri: '/events/' + event.id + '/positions/' + position.id + '/candidates',
            method: 'POST',
            body: candidate,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        const positionFromDb = await Position.findByPk(position.id);
        expect(positionFromDb.status).toEqual('closed');
    });

    const fieldsRequired = [
        'first_name',
        'last_name',
        'date_of_birth',
        'gender',
        'nationality',
        'languages',
        'studies',
        'member_since',
        'european_experience',
        'local_experience',
        'attended_agorae',
        'attended_epm',
        'attended_conferences',
        'external_experience',
        'motivation',
        'program',
        'related_experience',
        'agreed_to_privacy_policy'
    ];

    for (const field of fieldsRequired) {
        test(`should fail if ${field} is not set`, async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });

            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const position = await generator.createPosition({
                starts: moment().subtract(1, 'week').toDate(),
                ends: moment().add(1, 'week').toDate()
            }, event);
            const candidate = generator.generateCandidate({ body_id: regularUser.bodies[0].id });
            candidate[field] = null;

            const res = await request({
                uri: '/events/' + event.id + '/positions/' + position.id + '/candidates',
                method: 'POST',
                body: candidate,
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(res.body).not.toHaveProperty('data');
            expect(res.body).toHaveProperty('errors');
            expect(res.body.errors).toHaveProperty(field);
        });
    }

    const datesRequired = [
        'date_of_birth',
        'member_since'
    ];

    for (const field of datesRequired) {
        test(`should fail if ${field} is not a string`, async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });

            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const position = await generator.createPosition({
                starts: moment().subtract(1, 'week').toDate(),
                ends: moment().add(1, 'week').toDate()
            }, event);
            const candidate = generator.generateCandidate({ body_id: regularUser.bodies[0].id });
            candidate[field] = false;

            const res = await request({
                uri: '/events/' + event.id + '/positions/' + position.id + '/candidates',
                method: 'POST',
                body: candidate,
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(res.body).not.toHaveProperty('data');
            expect(res.body).toHaveProperty('errors');
            expect(res.body.errors).toHaveProperty(field);
        });

        test(`should fail if ${field} is not a valid date`, async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });

            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const position = await generator.createPosition({
                starts: moment().subtract(1, 'week').toDate(),
                ends: moment().add(1, 'week').toDate()
            }, event);
            const candidate = generator.generateCandidate({ body_id: regularUser.bodies[0].id });
            candidate[field] = 'test string';

            const res = await request({
                uri: '/events/' + event.id + '/positions/' + position.id + '/candidates',
                method: 'POST',
                body: candidate,
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(res.body).not.toHaveProperty('data');
            expect(res.body).toHaveProperty('errors');
            expect(res.body.errors).toHaveProperty(field);
        });
    }

    test('should fail if languages is not an array', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().subtract(1, 'week').toDate(),
            ends: moment().add(1, 'week').toDate()
        }, event);
        const candidate = generator.generateCandidate({
            body_id: regularUser.bodies[0].id,
            languages: false
        });

        const res = await request({
            uri: '/events/' + event.id + '/positions/' + position.id + '/candidates',
            method: 'POST',
            body: candidate,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('languages');
    });

    test('should fail if languages is empty array', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().subtract(1, 'week').toDate(),
            ends: moment().add(1, 'week').toDate()
        }, event);
        const candidate = generator.generateCandidate({
            body_id: regularUser.bodies[0].id,
            languages: []
        });

        const res = await request({
            uri: '/events/' + event.id + '/positions/' + position.id + '/candidates',
            method: 'POST',
            body: candidate,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('languages');
    });

    test('should fail if one of the languages is not a string', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().subtract(1, 'week').toDate(),
            ends: moment().add(1, 'week').toDate()
        }, event);
        const candidate = generator.generateCandidate({
            body_id: regularUser.bodies[0].id,
            languages: [false]
        });

        const res = await request({
            uri: '/events/' + event.id + '/positions/' + position.id + '/candidates',
            method: 'POST',
            body: candidate,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('languages');
    });

    test('should fail if one of the languages is empty string', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().subtract(1, 'week').toDate(),
            ends: moment().add(1, 'week').toDate()
        }, event);
        const candidate = generator.generateCandidate({
            body_id: regularUser.bodies[0].id,
            languages: ['']
        });

        const res = await request({
            uri: '/events/' + event.id + '/positions/' + position.id + '/candidates',
            method: 'POST',
            body: candidate,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('languages');
    });

    test('should fail if one of the languages is string of spaces and tabs', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().subtract(1, 'week').toDate(),
            ends: moment().add(1, 'week').toDate()
        }, event);
        const candidate = generator.generateCandidate({
            body_id: regularUser.bodies[0].id,
            languages: ['        ']
        });

        const res = await request({
            uri: '/events/' + event.id + '/positions/' + position.id + '/candidates',
            method: 'POST',
            body: candidate,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('languages');
    });

    test('should fail if not agreed to privacy policy', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().subtract(1, 'week').toDate(),
            ends: moment().add(1, 'week').toDate()
        }, event);
        const candidate = generator.generateCandidate({
            body_id: regularUser.bodies[0].id,
            agreed_to_privacy_policy: false
        });

        const res = await request({
            uri: '/events/' + event.id + '/positions/' + position.id + '/candidates',
            method: 'POST',
            body: candidate,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('agreed_to_privacy_policy');
    });

    test('should fail if email is not set', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().subtract(1, 'week').toDate(),
            ends: moment().add(1, 'week').toDate()
        }, event);
        const candidate = generator.generateCandidate({
            body_id: regularUser.bodies[0].id,
            email: null
        });

        const res = await request({
            uri: '/events/' + event.id + '/positions/' + position.id + '/candidates',
            method: 'POST',
            body: candidate,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('email');
    });

    test('should fail if email is invalid', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().subtract(1, 'week').toDate(),
            ends: moment().add(1, 'week').toDate()
        }, event);
        const candidate = generator.generateCandidate({
            body_id: regularUser.bodies[0].id,
            email: 'totally-not-an-email'
        });

        const res = await request({
            uri: '/events/' + event.id + '/positions/' + position.id + '/candidates',
            method: 'POST',
            body: candidate,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('email');
    });
});
