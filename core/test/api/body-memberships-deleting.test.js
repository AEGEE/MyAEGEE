const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { BodyMembership, CircleMembership, User } = require('../../models');
const mock = require('../scripts/mock');
const config = require('../../config');
const constants = require('../../lib/constants');

describe('Body memberships deleting', () => {
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

    test('should return 404 if the membership is not found', async () => {
        const body = await generator.createBody();
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({
            scope: 'global',
            action: 'delete_member',
            object: 'body',
        });

        const res = await request({
            path: '/bodies/' + body.id + '/members/1337',
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value },
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed if everything is okay', async () => {
        const body = await generator.createBody();
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);
        const membership = await generator.createBodyMembership(body, user);

        await generator.createPermission({
            scope: 'global',
            action: 'delete_member',
            object: 'body',
        });

        const res = await request({
            path: '/bodies/' + body.id + '/members/' + membership.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value },
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        const membershipFromDb = await BodyMembership.findByPk(membership.id);
        expect(membershipFromDb).toEqual(null);
    });

    test('should remove user from any circles in this body', async () => {
        const body = await generator.createBody();
        const circle = await generator.createCircle({ body_id: body.id });
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({
            scope: 'global',
            action: 'delete_member',
            object: 'body',
        });

        const circleMembership = await generator.createCircleMembership(
            circle,
            user
        );
        const membership = await generator.createBodyMembership(body, user);

        const res = await request({
            path: '/bodies/' + body.id + '/members/' + membership.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value },
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        const membershipFromDb = await CircleMembership.findByPk(
            circleMembership.id
        );
        expect(membershipFromDb).toEqual(null);
    });

    test('should unset primary body', async () => {
        const body = await generator.createBody();
        const user = await generator.createUser({
            superadmin: true,
            primary_body_id: body.id,
        });
        const token = await generator.createAccessToken(user);
        const membership = await generator.createBodyMembership(body, user);

        await generator.createPermission({
            scope: 'global',
            action: 'delete_member',
            object: 'body',
        });

        const res = await request({
            path: '/bodies/' + body.id + '/members/' + membership.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value },
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        const memberFromDb = await User.findByPk(user.id);
        expect(memberFromDb.primary_body_id).toEqual(null);
    });

    test('should work with local permission', async () => {
        const body = await generator.createBody();
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);
        const membership = await generator.createBodyMembership(body, user);

        const permission = await generator.createPermission({
            scope: 'local',
            action: 'delete_member',
            object: 'body',
        });
        const circle = await generator.createCircle({ body_id: body.id });
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);

        const res = await request({
            path: '/bodies/' + body.id + '/members/' + membership.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value },
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if no permission', async () => {
        const body = await generator.createBody();
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);
        const membership = await generator.createBodyMembership(body, user);

        const res = await request({
            path: '/bodies/' + body.id + '/members/' + membership.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value },
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    describe('notice to the Google Workspace administrators', () => {
        let mails;
        let token;
        let body;

        beforeEach(async () => {
            mails = mock.captureMails();

            const user = await generator.createUser({ superadmin: true });
            token = await generator.createAccessToken(user);
            await generator.createPermission({ scope: 'global', action: 'delete_member', object: 'body' });

            body = await generator.createBody();
        });

        const remove = (membership) => request({
            path: '/bodies/' + body.id + '/members/' + membership.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value },
        });

        test('should be sent when a member is removed from their last body', async () => {
            const member = await generator.createUser({
                first_name: 'Some',
                last_name: 'One',
                gsuite_id: 'some.one@aegee.eu',
            });
            const membership = await generator.createBodyMembership(body, member);

            const res = await remove(membership);

            expect(res.statusCode).toEqual(200);
            expect(res.body).toEqual({ success: true, message: 'Membership is deleted' });
            expect(mails).toEqual([
                {
                    to: config.google_workspace_notifications,
                    subject: constants.MAIL_SUBJECTS.WORKSPACE_DELETED_MEMBER,
                    template: 'workspace_deleted_member.html',
                    parameters: {
                        member_firstname: 'Some',
                        member_lastname: 'One',
                        user_id: member.id,
                        member_workspace_email: 'some.one@aegee.eu',
                    },
                },
            ]);
        });

        test('should name no Workspace address for a member who has none', async () => {
            const member = await generator.createUser();
            const membership = await generator.createBodyMembership(body, member);

            const res = await remove(membership);

            expect(res.statusCode).toEqual(200);
            expect(mails.length).toEqual(1);
            expect(mails[0].parameters).toEqual({
                member_firstname: member.first_name,
                member_lastname: member.last_name,
                user_id: member.id,
                member_workspace_email: null,
            });
        });

        test('should not be sent when the member is still in another body', async () => {
            const otherBody = await generator.createBody();
            const member = await generator.createUser();
            const membership = await generator.createBodyMembership(body, member);
            const otherMembership = await generator.createBodyMembership(otherBody, member);

            const res = await remove(membership);

            expect(res.statusCode).toEqual(200);
            expect(mails).toEqual([]);

            const memberships = await BodyMembership.findAll({ where: { user_id: member.id } });
            expect(memberships.map((item) => item.id)).toEqual([otherMembership.id]);
        });

        test('should not be sent when the membership is not removed', async () => {
            const member = await generator.createUser();
            const membership = await generator.createBodyMembership(body, member);

            const stranger = await generator.createUser();
            const strangerToken = await generator.createAccessToken(stranger);

            const res = await request({
                path: '/bodies/' + body.id + '/members/' + membership.id,
                method: 'DELETE',
                headers: { 'X-Auth-Token': strangerToken.value },
            });

            expect(res.statusCode).toEqual(403);
            expect(mails).toEqual([]);
            expect(await BodyMembership.findByPk(membership.id)).not.toEqual(null);
        });
    });
});
