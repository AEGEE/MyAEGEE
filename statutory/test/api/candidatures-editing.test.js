const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;

const { Candidate } = require('../../models');

// Someone else than the logged in user, with a body the logged in user is not a member of.
const otherUser = {
    ...regularUser,
    id: regularUser.id + 1,
    bodies: [{ ...regularUser.bodies[0], id: 1337, name: 'AEGEE-Elsewhere' }]
};

describe('Candidates editing', () => {
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

    test('should return 403 if the application is not pending', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().add(1, 'week').toDate(),
            ends: moment().add(2, 'week').toDate(),
            candidates: [
                generator.generateCandidate({ user_id: regularUser.id, status: 'approved' })
            ]
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates/' + position.candidates[0].id,
            method: 'PUT',
            body: { first_name: 'Different' },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
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
            method: 'PUT',
            body: { first_name: 'Different' },
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
            method: 'PUT',
            body: { first_name: 'Different' },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should succeed if everything is okay', async () => {
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
            method: 'PUT',
            body: { first_name: 'Different', body_id: regularUser.bodies[0].id },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
    });

    test('should keep the body when no body is sent', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().subtract(1, 'week').toDate(),
            ends: moment().add(1, 'week').toDate(),
            candidates: [
                generator.generateCandidate({ user_id: regularUser.id, body_id: 34, body_name: 'AEGEE-Alicante' })
            ]
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates/' + position.candidates[0].id,
            method: 'PUT',
            body: { first_name: 'Different', body_name: 'Made up body' },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);

        const candidate = await Candidate.findByPk(position.candidates[0].id);
        expect(candidate.first_name).toEqual('Different');
        expect(candidate.body_id).toEqual(34);
        expect(candidate.body_name).toEqual('AEGEE-Alicante');
    });

    test('should not let a candidate pick a body they are not a member of', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().subtract(1, 'week').toDate(),
            ends: moment().add(1, 'week').toDate(),
            candidates: [
                generator.generateCandidate({ user_id: regularUser.id, body_id: 34, body_name: 'AEGEE-Alicante' })
            ]
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates/' + position.candidates[0].id,
            method: 'PUT',
            body: { body_id: 1337 },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body.message).toEqual('The candidate is not a member of this body.');

        const candidate = await Candidate.findByPk(position.candidates[0].id);
        expect(candidate.body_id).toEqual(34);
    });

    // Collects the paths of the members fetched from core.
    const trackMemberRequests = (stubs) => {
        const paths = [];
        stubs.coreMemberStub.on('request', (req) => paths.push(req.path));
        return paths;
    };

    test('should use the candidate\'s body name when someone else edits the candidature', async () => {
        // Logged in as regularUser, with permissions to manage candidates.
        const memberRequests = trackMemberRequests(mock.mockAll({ member: { user: otherUser } }));

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().subtract(1, 'week').toDate(),
            ends: moment().add(1, 'week').toDate(),
            candidates: [
                generator.generateCandidate({ user_id: otherUser.id, body_id: 34, body_name: 'AEGEE-Alicante' })
            ]
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates/' + position.candidates[0].id,
            method: 'PUT',
            body: { body_id: 1337 },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);

        const candidate = await Candidate.findByPk(position.candidates[0].id);
        expect(candidate.user_id).toEqual(otherUser.id);
        expect(candidate.body_id).toEqual(1337);
        expect(candidate.body_name).toEqual('AEGEE-Elsewhere');
        // The candidate is fetched, not the logged in user.
        expect(memberRequests).toEqual(['/members/' + otherUser.id]);
    });

    test('should let someone else edit the candidature without changing the body', async () => {
        const memberRequests = trackMemberRequests(mock.mockAll({ member: { user: otherUser } }));

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().subtract(1, 'week').toDate(),
            ends: moment().add(1, 'week').toDate(),
            candidates: [
                generator.generateCandidate({ user_id: otherUser.id, body_id: 1337, body_name: 'AEGEE-Elsewhere' })
            ]
        }, event);

        // The frontend sends the whole candidature, including the current body.
        const res = await request({
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates/' + position.candidates[0].id,
            method: 'PUT',
            body: { first_name: 'Fixed typo', body_id: '1337' },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        const candidate = await Candidate.findByPk(position.candidates[0].id);
        expect(candidate.first_name).toEqual('Fixed typo');
        expect(candidate.body_id).toEqual(1337);
        expect(candidate.body_name).toEqual('AEGEE-Elsewhere');
        expect(memberRequests).toEqual([]);
    });

    test('should not move the candidature to another position', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().subtract(1, 'week').toDate(),
            ends: moment().add(1, 'week').toDate(),
            candidates: [
                generator.generateCandidate({ user_id: regularUser.id })
            ]
        }, event);
        // A position with a deadline that has passed.
        const otherPosition = await generator.createPosition({
            starts: moment().subtract(2, 'week').toDate(),
            ends: moment().subtract(1, 'week').toDate()
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates/' + position.candidates[0].id,
            method: 'PUT',
            body: { position_id: otherPosition.id },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        const candidate = await Candidate.findByPk(position.candidates[0].id);
        expect(candidate.position_id).toEqual(position.id);
    });

    test('should not let someone else move the candidature to a body of their own', async () => {
        mock.mockAll({ member: { user: otherUser } });

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({
            starts: moment().subtract(1, 'week').toDate(),
            ends: moment().add(1, 'week').toDate(),
            candidates: [
                generator.generateCandidate({ user_id: otherUser.id, body_id: 1337, body_name: 'AEGEE-Elsewhere' })
            ]
        }, event);

        // Body 34 is a body of the logged in user, not of the candidate.
        const res = await request({
            path: '/events/' + event.id + '/positions/' + position.id + '/candidates/' + position.candidates[0].id,
            method: 'PUT',
            body: { body_id: 34 },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.message).toEqual('The candidate is not a member of this body.');

        const candidate = await Candidate.findByPk(position.candidates[0].id);
        expect(candidate.body_id).toEqual(1337);
        expect(candidate.body_name).toEqual('AEGEE-Elsewhere');
    });
});
