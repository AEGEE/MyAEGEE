const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;
const { Candidate } = require('../../models');

describe('Candidates status', () => {
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
        mock.cleanAll();
        await generator.clearAll();
    });

    test('should return 403 if no permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().subtract(2, 'week').toDate(),
            ends: moment().subtract(1, 'week').toDate(),
            candidates: [
                generator.generateCandidate({ user_id: regularUser.id })
            ]
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates/' + position.candidates[0].id + '/status',
            method: 'PUT',
            body: { status: 'approved' },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 422 if status is malformed', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().subtract(2, 'week').toDate(),
            ends: moment().subtract(1, 'week').toDate(),
            candidates: [
                generator.generateCandidate({ user_id: regularUser.id })
            ]
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates/' + position.candidates[0].id + '/status',
            method: 'PUT',
            body: { status: false },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('status');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 200 if yes permissions', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().subtract(2, 'week').toDate(),
            ends: moment().subtract(1, 'week').toDate(),
            candidates: [
                generator.generateCandidate({ user_id: regularUser.id })
            ]
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates/' + position.candidates[0].id + '/status',
            method: 'PUT',
            body: { status: 'approved' },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
    });

    describe('who may set the status of a candidature and which', () => {
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
            mock.mockAll({ mainPermissions: { permissions: [MANAGE] } });
            event = await generator.createEvent({ type: 'agora', applications: [] });
            position = await generator.createPosition({}, event);
        });

        const setStatus = (candidate, body, targetEvent = event, targetPosition = position) => request({
            path: '/events/' + targetEvent.id + '/positions/' + targetPosition.id + '/candidates/' + candidate.id + '/status',
            method: 'PUT',
            body,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        const storedStatus = async (candidate) => (await Candidate.findByPk(candidate.id)).status;

        test.each([
            ['pending', 'approved'],
            ['pending', 'rejected'],
            ['approved', 'rejected'],
            ['rejected', 'approved'],
            ['approved', 'pending']
        ])('lets a holder of global:manage_candidates:agora alone change a %s candidature to %s', async (from, to) => {
            const candidate = await generator.createCandidate({ user_id: 1337, status: from }, position);

            const res = await setStatus(candidate, { status: to });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({ id: candidate.id, status: to });
            expect(await storedStatus(candidate)).toEqual(to);
        });

        test('refuses the candidate, also with the permission for another event type and the other permissions for an Agora', async () => {
            mock.mockAll({ mainPermissions: { permissions: OTHER_PERMISSIONS } });
            const candidate = await generator.createCandidate({ user_id: regularUser.id }, position);

            const res = await setStatus(candidate, { status: 'approved' });

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual({ success: false, message: 'You cannot update this candidature\'s status.' });
            expect(await storedStatus(candidate)).toEqual('pending');
        });

        test.each([
            ['a status that does not exist', 'elected', 'Candidature status should be one of these: "approved", "rejected", "pending".'],
            ['null', null, 'candidate.status cannot be null']
        ])('answers 422 for %s and changes nothing', async (description, status, message) => {
            const candidate = await generator.createCandidate({ user_id: 1337, status: 'approved' }, position);

            const res = await setStatus(candidate, { status });

            expect(res.statusCode).toEqual(422);
            expect(res.body).toEqual({ success: false, errors: { status: [message] } });
            expect(await storedStatus(candidate)).toEqual('approved');
        });

        test('changes nothing without a status in the body', async () => {
            const candidate = await generator.createCandidate({ user_id: 1337, status: 'approved' }, position);

            const res = await setStatus(candidate, {});

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.status).toEqual('approved');
            expect(await storedStatus(candidate)).toEqual('approved');
        });

        test.each(['epm', 'spm'])('answers 400 for an %s event and changes nothing', async (type) => {
            mock.mockAll({ mainPermissions: { permissions: [MANAGE, `global:manage_candidates:${type}`] } });
            const otherEvent = await generator.createEvent({ type, applications: [] });
            const otherPosition = await generator.createPosition({}, otherEvent);
            const candidate = await generator.createCandidate({ user_id: 1337 }, otherPosition);

            const res = await setStatus(candidate, { status: 'approved' }, otherEvent, otherPosition);

            expect(res.statusCode).toEqual(400);
            expect(res.body).toEqual({ success: false, message: 'You can only access memberslist for Agora.' });
            expect(await storedStatus(candidate)).toEqual('pending');
        });
    });
});
