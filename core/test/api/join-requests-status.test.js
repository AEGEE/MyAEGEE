const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { JoinRequest, BodyMembership, CircleMembership } = require('../../models');
const mock = require('../scripts/mock');
const config = require('../../config');
const constants = require('../../lib/constants');

describe('Join request status', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        await mock.mockAll();
    });

    afterEach(async () => {
        await generator.clearAll();
        await mock.cleanAll();
    });

    test('should return 400 if the request_id is invalid', async () => {
        const body = await generator.createBody();
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'process', object: 'join_request' });

        const res = await request({
            path: '/bodies/' + body.id + '/join-requests/lalala/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { status: 'approved' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 404 if the join request is not found', async () => {
        const body = await generator.createBody();
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'process', object: 'join_request' });

        const res = await request({
            path: '/bodies/' + body.id + '/join-requests/1337/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { status: 'approved' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if the status is invalid', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        const joinRequest = await generator.createJoinRequest(body, user);

        await generator.createPermission({ scope: 'global', action: 'process', object: 'join_request' });

        const res = await request({
            path: '/bodies/' + body.id + '/join-requests/' + joinRequest.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { status: 'unknown' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if the status is not pending', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'process', object: 'join_request' });

        const body = await generator.createBody();
        const joinRequest = await JoinRequest.create({
            body_id: body.id,
            user_id: user.id,
            status: 'approved'
        });

        const res = await request({
            path: '/bodies/' + body.id + '/join-requests/' + joinRequest.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { status: 'rejected' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed if everything is okay and the status is rejected', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        const joinRequest = await generator.createJoinRequest(body, user);

        await generator.createPermission({ scope: 'global', action: 'process', object: 'join_request' });

        const res = await request({
            path: '/bodies/' + body.id + '/join-requests/' + joinRequest.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { status: 'rejected' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        const joinRequestFromDb = await JoinRequest.findByPk(joinRequest.id);
        expect(joinRequestFromDb).toEqual(null);
    });

    test('should succeed if everything is okay and the status is accepted', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        const joinRequest = await generator.createJoinRequest(body, user);

        await generator.createPermission({ scope: 'global', action: 'process', object: 'join_request' });

        const res = await request({
            path: '/bodies/' + body.id + '/join-requests/' + joinRequest.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { status: 'approved' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        const joinRequestFromDb = await JoinRequest.findByPk(joinRequest.id);
        expect(joinRequestFromDb).not.toEqual(null);

        const membershipFromDb = await BodyMembership.findOne({
            where: {
                user_id: user.id,
                body_id: body.id
            }
        });
        expect(membershipFromDb).not.toEqual(null);
    });

    test('should add the person to a shadow circle', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const circle = await generator.createCircle();
        const body = await generator.createBody({ shadow_circle_id: circle.id });
        const joinRequest = await generator.createJoinRequest(body, user);

        await generator.createPermission({ scope: 'global', action: 'process', object: 'join_request' });

        const res = await request({
            path: '/bodies/' + body.id + '/join-requests/' + joinRequest.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { status: 'approved' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        const membershipFromDb = await CircleMembership.findOne({
            where: {
                circle_id: circle.id,
                user_id: user.id
            }
        });
        expect(membershipFromDb).not.toEqual(null);
    });

    test('should work with local permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        const joinRequest = await generator.createJoinRequest(body, user);

        const circle = await generator.createCircle({ body_id: body.id });
        const permission = await generator.createPermission({ scope: 'local', action: 'process', object: 'join_request' });
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);

        const res = await request({
            path: '/bodies/' + body.id + '/join-requests/' + joinRequest.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { status: 'approved' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if no permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        const joinRequest = await generator.createJoinRequest(body, user);

        const res = await request({
            path: '/bodies/' + body.id + '/join-requests/' + joinRequest.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { status: 'approved' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    describe('for an applicant with or without a body', () => {
        let mails;
        let token;
        let body;

        beforeEach(async () => {
            mails = mock.captureMails();

            const user = await generator.createUser({ superadmin: true });
            token = await generator.createAccessToken(user);
            await generator.createPermission({ scope: 'global', action: 'process', object: 'join_request' });

            body = await generator.createBody({ name: 'AEGEE-Somewhere' });
        });

        const setStatus = (joinRequest, status) => request({
            path: '/bodies/' + body.id + '/join-requests/' + joinRequest.id + '/status',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { status }
        });

        test('should welcome an approved applicant without a body and tell the Google Workspace administrators', async () => {
            const applicant = await generator.createUser({
                first_name: 'Some',
                last_name: 'Applicant',
                email: 'some.applicant@example.com'
            });
            const joinRequest = await generator.createJoinRequest(body, applicant);

            const res = await setStatus(joinRequest, 'approved');

            expect(res.statusCode).toEqual(200);
            expect(res.body).toEqual({ success: true, message: 'The join request was changed to "approved".' });
            expect(mails).toEqual([
                {
                    to: 'some.applicant@example.com',
                    subject: constants.MAIL_SUBJECTS.NEW_MEMBER,
                    template: 'new_member.html',
                    parameters: {
                        member_firstname: 'Some',
                        member_lastname: 'Applicant',
                        body_name: 'AEGEE-Somewhere',
                        body_id: body.id
                    }
                },
                {
                    to: config.google_workspace_notifications,
                    subject: constants.MAIL_SUBJECTS.WORKSPACE_NEW_MEMBER,
                    template: 'workspace_new_member.html',
                    parameters: {
                        member_firstname: 'Some',
                        member_lastname: 'Applicant',
                        user_id: applicant.id,
                        member_email: 'some.applicant@example.com'
                    }
                }
            ]);
        });

        test('should send no mail when approving an applicant who is in another body already', async () => {
            const otherBody = await generator.createBody();
            const applicant = await generator.createUser();
            await generator.createBodyMembership(otherBody, applicant);
            const joinRequest = await generator.createJoinRequest(body, applicant);

            const res = await setStatus(joinRequest, 'approved');

            expect(res.statusCode).toEqual(200);
            expect(mails).toEqual([]);
            expect(await BodyMembership.count({ where: { body_id: body.id, user_id: applicant.id } })).toEqual(1);
            expect((await JoinRequest.findByPk(joinRequest.id)).status).toEqual('approved');
        });

        test('should send no mail when rejecting an applicant', async () => {
            const applicant = await generator.createUser();
            const joinRequest = await generator.createJoinRequest(body, applicant);

            const res = await setStatus(joinRequest, 'rejected');

            expect(res.statusCode).toEqual(200);
            expect(res.body).toEqual({ success: true, message: 'The join request was changed to "rejected".' });
            expect(mails).toEqual([]);
            expect(await BodyMembership.count({ where: { user_id: applicant.id } })).toEqual(0);
        });

        // A board can add the applicant by hand while the request is still waiting.
        test('should fail when approving an applicant who is a member of the body by now, and keep the request pending', async () => {
            const applicant = await generator.createUser();
            const joinRequest = await generator.createJoinRequest(body, applicant);
            const membership = await generator.createBodyMembership(body, applicant);

            const res = await setStatus(joinRequest, 'approved');

            expect(res.statusCode).toEqual(422);
            expect(res.body).toEqual({
                success: false,
                errors: { body_id: ['body_id must be unique'], user_id: ['user_id must be unique'] }
            });

            const memberships = await BodyMembership.findAll({ where: { body_id: body.id, user_id: applicant.id } });
            expect(memberships.map((item) => item.id)).toEqual([membership.id]);
            expect((await JoinRequest.findByPk(joinRequest.id)).status).toEqual('pending');
            expect(mails).toEqual([]);
        });

        test('should let such a request be rejected, and keep the membership', async () => {
            const applicant = await generator.createUser();
            const joinRequest = await generator.createJoinRequest(body, applicant);
            const membership = await generator.createBodyMembership(body, applicant);

            const res = await setStatus(joinRequest, 'rejected');

            expect(res.statusCode).toEqual(200);
            expect(await JoinRequest.findByPk(joinRequest.id)).toEqual(null);
            expect(await BodyMembership.findByPk(membership.id)).not.toEqual(null);
        });
    });
});
