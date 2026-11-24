const { startServer, stopServer } = require('../../lib/server');
const { BodyMembership, CircleMembership } = require('../../models');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const mock = require('../scripts/mock');
const config = require('../../config');
const constants = require('../../lib/constants');

describe('Body membership creating', () => {
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

    test('should return 404 if the user is not found', async () => {
        const body = await generator.createBody();
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'add_member', object: 'body' });

        const res = await request({
            path: '/bodies/' + body.id + '/members',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { user_id: 2147483647 }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed if everything is okay', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();

        await generator.createPermission({ scope: 'global', action: 'add_member', object: 'body' });

        const res = await request({
            path: '/bodies/' + body.id + '/members',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { user_id: user.id }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.user_id).toEqual(user.id);
        expect(res.body.data.body_id).toEqual(body.id);
    });

    test('should add a person to shadow circle', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const shadowCircle = await generator.createCircle();
        const body = await generator.createBody({ shadow_circle_id: shadowCircle.id });
        await shadowCircle.update({ body_id: body.id });

        await generator.createPermission({ scope: 'global', action: 'add_member', object: 'body' });

        const res = await request({
            path: '/bodies/' + body.id + '/members',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { user_id: user.id }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.user_id).toEqual(user.id);
        expect(res.body.data.body_id).toEqual(body.id);

        const membership = await CircleMembership.findOne({
            where: {
                circle_id: shadowCircle.id,
                user_id: user.id
            }
        });

        expect(membership).not.toEqual(null);
    });

    test('should work with local permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        await generator.createBodyMembership(body, user);

        const permission = await generator.createPermission({ scope: 'local', action: 'add_member', object: 'body' });
        const circle = await generator.createCircle({ body_id: body.id });
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);

        const otherUser = await generator.createUser();

        const res = await request({
            path: '/bodies/' + body.id + '/members',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { user_id: otherUser.id }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
    });

    test('should fail if no permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();

        const res = await request({
            path: '/bodies/' + body.id + '/members',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { user_id: user.id }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test.each([
        ['missing', undefined],
        ['a text that is not a number', 'abc'],
        ['an empty text', ''],
        ['a list', [1]],
        ['an object', { id: 1 }],
        ['a fraction', 1.5],
        ['a boolean', true],
        ['null', null]
    ])('should return 400 if the user id is %s', async (name, value) => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);
        await generator.createPermission({ scope: 'global', action: 'add_member', object: 'body' });
        const body = await generator.createBody();

        const res = await request({
            path: '/bodies/' + body.id + '/members',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { user_id: value }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body).toEqual({ success: false, message: 'The user ID is not valid.' });
    });

    describe('for a member with or without a body', () => {
        let mails;
        let token;
        let body;

        beforeEach(async () => {
            mails = mock.captureMails();

            const user = await generator.createUser({ superadmin: true });
            token = await generator.createAccessToken(user);
            await generator.createPermission({ scope: 'global', action: 'add_member', object: 'body' });

            body = await generator.createBody({ name: 'AEGEE-Somewhere' });
        });

        const add = (member) => request({
            path: '/bodies/' + body.id + '/members',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { user_id: member.id }
        });

        test('should fail for a member of the body, and keep the one membership', async () => {
            const member = await generator.createUser();
            const membership = await generator.createBodyMembership(body, member);

            const res = await add(member);

            expect(res.statusCode).toEqual(422);
            expect(res.body).toEqual({
                success: false,
                errors: { body_id: ['body_id must be unique'], user_id: ['user_id must be unique'] }
            });

            const memberships = await BodyMembership.findAll({ where: { body_id: body.id, user_id: member.id } });
            expect(memberships.map((item) => item.id)).toEqual([membership.id]);
            expect(mails).toEqual([]);
        });

        test('should fail for a member of the body without adding them to the shadow circle again', async () => {
            const shadowCircle = await generator.createCircle({ body_id: body.id });
            await body.update({ shadow_circle_id: shadowCircle.id });

            const member = await generator.createUser();
            await generator.createBodyMembership(body, member);

            const res = await add(member);

            expect(res.statusCode).toEqual(422);
            expect(await CircleMembership.count({ where: { circle_id: shadowCircle.id, user_id: member.id } })).toEqual(1);
        });

        test('should send no mail for a member who is in another body already', async () => {
            const otherBody = await generator.createBody();
            const member = await generator.createUser();
            await generator.createBodyMembership(otherBody, member);

            const res = await add(member);

            expect(res.statusCode).toEqual(200);
            expect(await BodyMembership.count({ where: { body_id: body.id, user_id: member.id } })).toEqual(1);
            expect(mails).toEqual([]);
        });

        test('should welcome a member without a body and tell the Google Workspace administrators', async () => {
            const member = await generator.createUser({
                first_name: 'Some',
                last_name: 'One',
                email: 'some.one@example.com'
            });

            const res = await add(member);

            expect(res.statusCode).toEqual(200);
            expect(mails).toEqual([
                {
                    to: 'some.one@example.com',
                    subject: constants.MAIL_SUBJECTS.NEW_MEMBER,
                    template: 'new_member.html',
                    parameters: {
                        member_firstname: 'Some',
                        member_lastname: 'One',
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
                        member_lastname: 'One',
                        user_id: member.id,
                        member_email: 'some.one@example.com'
                    }
                }
            ]);
        });

        // The welcome goes to the address the member reads; the administrators get the personal one.
        test('should welcome a member on their Workspace address if that is their primary one', async () => {
            const member = await generator.createUser({
                email: 'some.one@example.com',
                gsuite_id: 'example-some.one@aegee.eu',
                primary_email: 'gsuite'
            });

            const res = await add(member);

            expect(res.statusCode).toEqual(200);
            expect(mails.map((mail) => [mail.template, mail.to])).toEqual([
                ['new_member.html', 'example-some.one@aegee.eu'],
                ['workspace_new_member.html', config.google_workspace_notifications]
            ]);
            expect(mails[1].parameters.member_email).toEqual('some.one@example.com');
        });
    });
});
