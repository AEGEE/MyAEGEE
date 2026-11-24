const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;
const { MAIL_FAILURES, spyOnMailFailures, countFailedMails } = require('../scripts/mail-failures');
const { Candidate, Image, Position } = require('../../models');
const config = require('../../config');

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
        jest.restoreAllMocks();
        await generator.clearAll();
        mock.cleanAll();
    });

    test('should allow candidature submission when user has an active event application ban', async () => {
        mock.mockAll({ core: { eventApplicationBanned: true }, mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().subtract(1, 'week').toDate(),
            ends: moment().add(1, 'week').toDate()
        }, event);
        const candidate = generator.generateCandidate({ body_id: regularUser.bodies[0].id });

        const res = await request({
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates',
            method: 'POST',
            body: candidate,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
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
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates',
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
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates',
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
            path: '/events/' + event.id + '/positions/1337/candidates',
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
            path: '/events/' + event.id + '/positions/false/candidates',
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
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates',
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
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates',
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
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates',
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

    test('should ignore the image_id from the body', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        // An image that belongs to somebody else, for example another candidate's photo.
        const otherImage = await Image.create({ user_id: 1337, file_name: 'other.png', file_folder: 'test' });
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().subtract(1, 'week').toDate(),
            ends: moment().add(1, 'week').toDate()
        }, event);
        const candidate = generator.generateCandidate({ body_id: regularUser.bodies[0].id, image_id: otherImage.id });

        const res = await request({
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates',
            method: 'POST',
            body: candidate,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        const candidateFromDb = await Candidate.findByPk(res.body.data.id);
        expect(candidateFromDb.image_id).toEqual(null);
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
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates',
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
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates',
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
                generator.generateCandidate({ status: 'approved', user_id: 1337 })
            ]
        }, event);
        const candidate = generator.generateCandidate({ body_id: regularUser.bodies[0].id, user_id: regularUser.id });

        const res = await request({
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates',
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
                path: '/events/' + event.id + '/positions/' + position.id + '/candidates',
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
                path: '/events/' + event.id + '/positions/' + position.id + '/candidates',
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
                path: '/events/' + event.id + '/positions/' + position.id + '/candidates',
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
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates',
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
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates',
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
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates',
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
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates',
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
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates',
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
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates',
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

    // The candidature is saved first. The mail about it is sent afterwards: when it cannot
    // be sent, the candidature stays and the failure is logged with the ids and the template
    // and counted.
    test.each(MAIL_FAILURES.filter(([, failure]) => failure.mailer))('should save the candidature and answer 200 when %s', async (description, failure) => {
        mock.mockAll(failure);
        const log = spyOnMailFailures();

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().subtract(1, 'week').toDate(),
            ends: moment().add(1, 'week').toDate()
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates',
            method: 'POST',
            body: generator.generateCandidate({ body_id: regularUser.bodies[0].id }),
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);

        const candidates = await Candidate.findAll();
        expect(candidates.length).toEqual(1);
        expect(res.body.data.id).toEqual(candidates[0].id);

        expect(log.entries()).toEqual([{
            template: 'candidate_applied.html',
            candidate_id: candidates[0].id,
            position_id: position.id,
            event_id: event.id,
            err: expect.any(Error)
        }]);
        expect(log.text()).not.toContain('@');
        expect(await countFailedMails('candidate_applied.html')).toBeGreaterThanOrEqual(1);
    });

    describe('who may submit a candidature and when', () => {
        const MANAGE = 'global:manage_candidates:agora';
        const bodyId = regularUser.bodies[0].id;
        let event;

        beforeEach(async () => {
            event = await generator.createEvent({ type: 'agora', applications: [] });
        });

        const submit = (position, body = generator.generateCandidate({ body_id: bodyId }), targetEvent = event) => request({
            path: '/events/' + targetEvent.id + '/positions/' + position.id + '/candidates',
            method: 'POST',
            body,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        // The position as the test needs it: its period, and its status when that is not the one of the period.
        const periods = {
            'has not started': { starts: moment().add(1, 'week').toDate(), ends: moment().add(2, 'weeks').toDate() },
            runs: { starts: moment().subtract(1, 'week').toDate(), ends: moment().add(1, 'week').toDate() },
            'is over': { starts: moment().subtract(2, 'weeks').toDate(), ends: moment().subtract(1, 'week').toDate() }
        };

        const createPosition = async (period, status) => {
            const position = await generator.createPosition({ ...periods[period] }, event);
            if (status && status !== position.status) {
                // As a manager does through the status route, without touching the period.
                await position.update({ status }, { hooks: false });
            }

            return position;
        };

        test.each([
            ['lets', 'a member without permissions', 'runs', undefined, [], 200],
            ['refuses', 'a member without permissions', 'has not started', undefined, [], 403],
            ['refuses', 'a member without permissions', 'is over', undefined, [], 403],
            ['refuses', 'a holder of the permission for another event type', 'is over', undefined, ['global:manage_candidates:epm', 'global:manage_event:agora'], 403],
            ['lets', 'a holder of global:manage_candidates:agora alone', 'has not started', undefined, [MANAGE], 200],
            ['lets', 'a holder of global:manage_candidates:agora alone', 'is over', undefined, [MANAGE], 200],
            // The status decides, not the period: a manager can close a position early and open it again later.
            ['refuses', 'a member without permissions', 'runs', 'closed', [], 403],
            ['lets', 'a member without permissions', 'is over', 'open', [], 200]
        ])('%s %s submit a candidature for a position whose period %s (status %s)', async (verb, who, period, status, permissions, expected) => {
            mock.mockAll({ mainPermissions: { permissions } });
            const position = await createPosition(period, status);

            const res = await submit(position);

            expect(res.statusCode).toEqual(expected);
            if (expected === 200) {
                const candidates = await Candidate.findAll();
                expect(candidates.map((candidate) => [candidate.id, candidate.position_id, candidate.user_id]))
                    .toEqual([[res.body.data.id, position.id, regularUser.id]]);
            } else {
                expect(res.body).toEqual({ success: false, message: 'You cannot submit candidature.' });
                expect(await Candidate.count()).toEqual(0);
            }
        });

        test('stores the candidature as pending, for the caller and the name of their body, whatever the body says', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const position = await createPosition('runs');

            const res = await submit(position, {
                ...generator.generateCandidate({ body_id: bodyId }),
                status: 'approved',
                user_id: 1337,
                position_id: 1337,
                body_name: 'A made up body',
                email: 'someone@example.org'
            });

            expect(res.statusCode).toEqual(200);
            expect(await Candidate.findByPk(res.body.data.id)).toMatchObject({
                status: 'pending',
                user_id: regularUser.id,
                position_id: position.id,
                body_id: bodyId,
                body_name: regularUser.bodies[0].name,
                email: null
            });
        });

        test('lets a member candidate for two positions of the same Agora', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const first = await createPosition('runs');
            const second = await createPosition('runs');

            expect((await submit(first)).statusCode).toEqual(200);
            expect((await submit(second)).statusCode).toEqual(200);

            const candidates = await Candidate.findAll({ order: [['id', 'ASC']] });
            expect(candidates.map((candidate) => candidate.position_id)).toEqual([first.id, second.id]);
        });

        test('mails the notification address about the candidature, and nobody when it is refused', async () => {
            const stubs = mock.mockAll({ mainPermissions: { noPermissions: true } });
            const mails = [];
            stubs.mailerStub.on('request', (req, interceptor, body) => mails.push(JSON.parse(body)));

            const closedPosition = await createPosition('is over');
            expect((await submit(closedPosition)).statusCode).toEqual(403);
            expect(mails).toEqual([]);

            const position = await createPosition('runs');
            const res = await submit(position);

            expect(res.statusCode).toEqual(200);
            expect(mails.length).toEqual(1);
            expect(mails[0].to).toEqual(config.application_notification);
            expect(mails[0].subject).toEqual('A new application was submitted');
            expect(mails[0].template).toEqual('candidate_applied.html');
            expect(mails[0].parameters.position.id).toEqual(position.id);
            expect(mails[0].parameters.candidate.id).toEqual(res.body.data.id);
        });

        test('answers 404 for a deleted position and stores nothing', async () => {
            mock.mockAll({ mainPermissions: { permissions: [MANAGE] } });
            const position = await generator.createPosition({ ...periods.runs, deleted: true }, event);

            const res = await submit(position);

            expect(res.statusCode).toEqual(404);
            expect(res.body).toEqual({ success: false, message: 'Position is not found.' });
            expect(await Candidate.count()).toEqual(0);
        });

        test.each(['epm', 'spm'])('answers 400 for an %s event and stores nothing', async (type) => {
            mock.mockAll({ mainPermissions: { permissions: [MANAGE, `global:manage_candidates:${type}`] } });
            const otherEvent = await generator.createEvent({ type, applications: [] });
            const position = await generator.createPosition({ ...periods.runs }, otherEvent);

            const res = await submit(position, generator.generateCandidate({ body_id: bodyId }), otherEvent);

            expect(res.statusCode).toEqual(400);
            expect(res.body).toEqual({ success: false, message: 'You can only access memberslist for Agora.' });
            expect(await Candidate.count()).toEqual(0);
        });
    });
});
