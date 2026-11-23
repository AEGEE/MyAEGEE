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

    describe('who may edit a candidature and what it takes', () => {
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
            position = await generator.createPosition({
                starts: moment().subtract(1, 'week').toDate(),
                ends: moment().add(1, 'week').toDate() // status = open
            }, event);
        });

        const edit = (candidate, body, targetEvent = event, targetPosition = position) => request({
            path: '/events/' + targetEvent.id + '/positions/' + targetPosition.id + '/candidates/' + candidate.id,
            method: 'PUT',
            body,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        const storedName = async (candidate) => (await Candidate.findByPk(candidate.id)).first_name;

        test.each([
            ['lets', 'a candidate without permissions', 'their own pending candidature', [], regularUser.id, 'pending', 200],
            ['refuses', 'a candidate without permissions', 'their own approved candidature', [], regularUser.id, 'approved', 403],
            ['refuses', 'a candidate without permissions', 'their own rejected candidature', [], regularUser.id, 'rejected', 403],
            ['refuses', 'a member without permissions', 'the pending candidature of someone else', [], 1337, 'pending', 403],
            ['refuses', 'a holder of the permission for another event type', 'the pending candidature of someone else', OTHER_PERMISSIONS, 1337, 'pending', 403],
            ['lets', 'a holder of global:manage_candidates:agora alone', 'the pending candidature of someone else', [MANAGE], 1337, 'pending', 200],
            ['lets', 'a holder of global:manage_candidates:agora alone', 'the approved candidature of someone else', [MANAGE], 1337, 'approved', 200],
            ['lets', 'a holder of global:manage_candidates:agora alone', 'the rejected candidature of someone else', [MANAGE], 1337, 'rejected', 200],
            ['lets', 'a holder of global:manage_candidates:agora', 'their own approved candidature', [MANAGE], regularUser.id, 'approved', 200]
        ])('%s %s edit %s', async (verb, who, what, permissions, userId, status, expected) => {
            mock.mockAll({ mainPermissions: { permissions } });
            const candidate = await generator.createCandidate({ user_id: userId, status, first_name: 'Before' }, position);

            const res = await edit(candidate, { first_name: 'After' });

            expect(res.statusCode).toEqual(expected);
            if (expected === 200) {
                expect(res.body.data.first_name).toEqual('After');
                expect(res.body.data.status).toEqual(status);
                expect(await storedName(candidate)).toEqual('After');
            } else {
                expect(res.body).toEqual({ success: false, message: 'You cannot edit this candidature.' });
                expect(await storedName(candidate)).toEqual('Before');
            }
        });

        test('lets a candidate edit a pending candidature after the position closed', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const closedPosition = await generator.createPosition({
                starts: moment().subtract(2, 'weeks').toDate(),
                ends: moment().subtract(1, 'week').toDate() // status = closed
            }, event);
            const candidate = await generator.createCandidate({ user_id: regularUser.id, first_name: 'Before' }, closedPosition);

            const res = await edit(candidate, { first_name: 'After' }, event, closedPosition);

            expect(res.statusCode).toEqual(200);
            expect(await storedName(candidate)).toEqual('After');
        });

        test.each([
            ['no languages', { languages: [] }, 'languages'],
            ['languages that are not a list', { languages: 'English' }, 'languages'],
            ['an empty language', { languages: ['English', ' '] }, 'languages'],
            ['an empty first name', { first_name: '' }, 'first_name'],
            ['an empty last name', { last_name: '' }, 'last_name'],
            ['a date of birth that is not a date', { date_of_birth: 'not a date' }, 'date_of_birth'],
            ['a membership date that is not a date', { member_since: 'not a date' }, 'member_since'],
            ['an empty motivation', { motivation: '' }, 'motivation'],
            ['studies set to null', { studies: null }, 'studies'],
            ['a privacy policy that is not agreed to', { agreed_to_privacy_policy: false }, 'agreed_to_privacy_policy']
        ])('answers 422 for %s and changes nothing', async (description, change, field) => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const candidate = await generator.createCandidate({ user_id: regularUser.id, first_name: 'Before' }, position);
            const before = (await Candidate.findByPk(candidate.id)).toJSON();

            const res = await edit(candidate, { first_name: 'After', ...change });

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(Object.keys(res.body.errors)).toEqual([field]);
            expect((await Candidate.findByPk(candidate.id)).toJSON()).toEqual(before);
        });

        test('ignores the status, the user, the mail address and the image in the body', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const candidate = await generator.createCandidate({ user_id: regularUser.id }, position);

            const res = await edit(candidate, {
                first_name: 'After',
                status: 'approved',
                user_id: 1337,
                email: 'someone@example.org',
                image_id: 1337
            });

            expect(res.statusCode).toEqual(200);
            expect(await Candidate.findByPk(candidate.id)).toMatchObject({
                first_name: 'After',
                status: 'pending',
                user_id: regularUser.id,
                email: null,
                image_id: null
            });
        });

        test.each(['epm', 'spm'])('answers 400 for an %s event and changes nothing', async (type) => {
            mock.mockAll({ mainPermissions: { permissions: [MANAGE, `global:manage_candidates:${type}`] } });
            const otherEvent = await generator.createEvent({ type, applications: [] });
            const otherPosition = await generator.createPosition({}, otherEvent);
            const candidate = await generator.createCandidate({ user_id: regularUser.id, first_name: 'Before' }, otherPosition);

            const res = await edit(candidate, { first_name: 'After' }, otherEvent, otherPosition);

            expect(res.statusCode).toEqual(400);
            expect(res.body).toEqual({ success: false, message: 'You can only access memberslist for Agora.' });
            expect(await storedName(candidate)).toEqual('Before');
        });
    });
});
