const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;

describe('Candidates displaying', () => {
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

    test('should return 404 if candidate is not found', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().add(1, 'week').toDate(),
            ends: moment().add(2, 'week').toDate()
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates/1337',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should fail if candidate ID is NaN', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().add(1, 'week').toDate(),
            ends: moment().add(2, 'week').toDate()
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates/false',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 403 if no permission and is other user', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().subtract(1, 'week').toDate(),
            ends: moment().add(1, 'week').toDate(),
            candidates: [
                generator.generateCandidate({ user_id: 1337 })
            ]
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates/' + position.candidates[0].id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should succeed if everything is okay and have global permissions', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().subtract(1, 'week').toDate(),
            ends: moment().add(1, 'week').toDate(),
            candidates: [
                generator.generateCandidate({ user_id: 1337 })
            ]
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates/' + position.candidates[0].id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
    });

    test('should succeed if everything is okay and is my candidature', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().subtract(1, 'week').toDate(),
            ends: moment().add(1, 'week').toDate(),
            candidates: [
                generator.generateCandidate({ user_id: regularUser.id })
            ]
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates/' + position.candidates[0].id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
    });

    describe('who may see a candidature', () => {
        const MANAGE = 'global:manage_candidates:agora';
        const OTHER_PERMISSIONS = [
            'global:manage_candidates:epm',
            'global:manage_event:agora',
            'global:manage_applications:agora',
            'global:manage_plenaries:agora',
            'global:manage_question_lines:agora'
        ];
        let event;
        let position;

        beforeEach(async () => {
            event = await generator.createEvent({ type: 'agora', applications: [] });
            position = await generator.createPosition({}, event);
        });

        const get = (candidateId, targetEvent = event, targetPosition = position) => request({
            path: '/events/' + targetEvent.id + '/positions/' + targetPosition.id + '/candidates/' + candidateId,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        test.each(['pending', 'approved', 'rejected'])('shows a candidate without permissions their own %s candidature', async (status) => {
            mock.mockAll({ mainPermissions: { noPermissions: true }, approvePermissions: { noPermissions: true }, memberslistPermissions: { noPermissions: true } });
            const candidate = await generator.createCandidate({ user_id: regularUser.id, status }, position);

            const res = await get(candidate.id);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({
                id: candidate.id,
                user_id: regularUser.id,
                position_id: position.id,
                status,
                motivation: candidate.motivation,
                image: null
            });
        });

        test.each(['pending', 'approved', 'rejected'])('shows a holder of global:manage_candidates:agora alone the %s candidature of someone else', async (status) => {
            mock.mockAll({ mainPermissions: { permissions: [MANAGE] } });
            const candidate = await generator.createCandidate({ user_id: 1337, status }, position);

            const res = await get(candidate.id);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({ id: candidate.id, user_id: 1337, status });
        });

        test.each(['pending', 'approved', 'rejected'])(
            'refuses the %s candidature of someone else to a holder of the permission for another event type and of the other permissions for an Agora',
            async (status) => {
                mock.mockAll({ mainPermissions: { permissions: OTHER_PERMISSIONS } });
                const candidate = await generator.createCandidate({ user_id: 1337, status }, position);

                const res = await get(candidate.id);

                expect(res.statusCode).toEqual(403);
                expect(res.body).toEqual({ success: false, message: 'You cannot see this candidature.' });
            }
        );

        test('answers 404 for a candidature for a deleted position', async () => {
            const deletedPosition = await generator.createPosition({ deleted: true }, event);
            const candidate = await generator.createCandidate({ user_id: regularUser.id }, deletedPosition);

            const res = await get(candidate.id, event, deletedPosition);

            expect(res.statusCode).toEqual(404);
            expect(res.body).toEqual({ success: false, message: 'Position is not found.' });
        });

        // BUG: "Infinity" passes the check that the candidate id is a number and reaches the query,
        // which fails. Expected: 400, as for any other value that is not a candidate id.
        test('answers 500 for the candidate id Infinity', async () => {
            const res = await get('Infinity');

            expect(res.statusCode).toEqual(500);
            expect(res.body.success).toEqual(false);
        });

        test.each(['epm', 'spm'])('answers 400 for an %s event', async (type) => {
            mock.mockAll({ mainPermissions: { permissions: [MANAGE, `global:manage_candidates:${type}`] } });
            const otherEvent = await generator.createEvent({ type, applications: [] });
            const otherPosition = await generator.createPosition({}, otherEvent);
            const candidate = await generator.createCandidate({ user_id: regularUser.id }, otherPosition);

            const res = await get(candidate.id, otherEvent, otherPosition);

            expect(res.statusCode).toEqual(400);
            expect(res.body).toEqual({ success: false, message: 'You can only access memberslist for Agora.' });
        });
    });
});
