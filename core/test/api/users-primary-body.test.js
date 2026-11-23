const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { User } = require('../../models');

describe('User primary body setting', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should return 404 if the user is not found', async () => {
        const body = await generator.createBody();
        const user = await generator.createUser({ superadmin: true, primary_body_id: body.id });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'member' });

        const res = await request({
            path: '/members/1337/primary-body',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { primary_body_id: null }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed if everything is okay', async () => {
        const body = await generator.createBody();
        const user = await generator.createUser({ superadmin: true, primary_body_id: body.id });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'local', action: 'update', object: 'member' });

        const res = await request({
            path: '/members/' + user.id + '/primary-body',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { primary_body_id: null }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.primary_body_id).toEqual(null);
    });

    test('should fail if body is not found', async () => {
        const user = await generator.createUser({ superadmin: true, });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'local', action: 'update', object: 'member' });

        const res = await request({
            path: '/members/' + user.id + '/primary-body',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { primary_body_id: 1337 }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if user is not a member', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'local', action: 'update', object: 'member' });

        const body = await generator.createBody();

        const res = await request({
            path: '/members/' + user.id + '/primary-body',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { primary_body_id: body.id }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should allow setting body', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'local', action: 'update', object: 'member' });

        const body = await generator.createBody();
        await generator.createBodyMembership(body, user);

        const res = await request({
            path: '/members/' + user.id + '/primary-body',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { primary_body_id: body.id }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.primary_body_id).toEqual(body.id);
    });

    test('should work for yourself without permission', async () => {
        const body = await generator.createBody();
        const user = await generator.createUser({ primary_body_id: body.id });
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members/' + user.id + '/primary-body',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { primary_body_id: null }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
    });

    test('should work with local permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        const otherUser = await generator.createUser({ primary_body_id: body.id });
        const permission = await generator.createPermission({ scope: 'local', action: 'update', object: 'member' });
        const circle = await generator.createCircle({ body_id: body.id });
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);
        await generator.createBodyMembership(body, otherUser);

        const res = await request({
            path: '/members/' + otherUser.id + '/primary-body',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { primary_body_id: null }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.primary_body_id).toEqual(null);
    });

    test('should fail for other person without permission', async () => {
        const body = await generator.createBody();
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const otherUser = await generator.createUser({ primary_body_id: body.id });

        const res = await request({
            path: '/members/' + otherUser.id + '/primary-body',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { primary_body_id: null }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test.each([
        ['a text that is not a number', 'abc'],
        ['a list', [1]],
        ['an object', { id: 1 }],
        ['a fraction', 1.5],
        ['a negative number', -1],
        ['true', true]
    ])('should answer 400 if the body id is %s', async (name, value) => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);
        const body = await generator.createBody();
        await generator.createBodyMembership(body, user);
        await user.update({ primary_body_id: body.id });

        const res = await request({
            path: '/members/me/primary-body',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { primary_body_id: value }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body).toEqual({ success: false, message: 'The body ID is not valid.' });

        const userFromDb = await User.findByPk(user.id);
        expect(userFromDb.primary_body_id).toEqual(body.id);
    });

    test('should accept the body id as a text', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);
        const body = await generator.createBody();
        await generator.createBodyMembership(body, user);

        const res = await request({
            path: '/members/me/primary-body',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { primary_body_id: String(body.id) }
        });

        expect(res.statusCode).toEqual(200);

        const userFromDb = await User.findByPk(user.id);
        expect(userFromDb.primary_body_id).toEqual(body.id);
    });

    test.each(['me', 'id'])('should answer with the primary body that is set now (addressed by %s)', async (address) => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);
        const body = await generator.createBody();
        const otherBody = await generator.createBody();
        await generator.createBodyMembership(body, user);
        await generator.createBodyMembership(otherBody, user);
        await user.update({ primary_body_id: body.id });

        const path = '/members/' + (address === 'me' ? 'me' : user.id) + '/primary-body';

        const changed = await request({
            path,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { primary_body_id: String(otherBody.id) }
        });

        expect(changed.statusCode).toEqual(200);
        expect(changed.body.data.primary_body_id).toEqual(otherBody.id);
        expect(changed.body.data.primary_body.id).toEqual(otherBody.id);
        expect(changed.body.data.bodies.length).toEqual(2);

        const unset = await request({
            path,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { primary_body_id: null }
        });

        expect(unset.statusCode).toEqual(200);
        expect(unset.body.data.primary_body_id).toEqual(null);
        expect(unset.body.data.primary_body).toEqual(null);
    });

    describe('what is stored', () => {
        test('should store the primary body of that member only', async () => {
            const body = await generator.createBody();
            const user = await generator.createUser();
            const token = await generator.createAccessToken(user);
            await generator.createBodyMembership(body, user);

            const otherUser = await generator.createUser();
            await generator.createBodyMembership(body, otherUser);

            const res = await request({
                path: '/members/me/primary-body',
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { primary_body_id: body.id }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.id).toEqual(user.id);
            expect(res.body.data.primary_body_id).toEqual(body.id);
            expect(res.body.data.primary_body.id).toEqual(body.id);

            expect((await User.findByPk(user.id)).primary_body_id).toEqual(body.id);
            expect((await User.findByPk(otherUser.id)).primary_body_id).toBeNull();
        });

        test('should unset the primary body without the field', async () => {
            const body = await generator.createBody();
            const user = await generator.createUser();
            const token = await generator.createAccessToken(user);
            await generator.createBodyMembership(body, user);
            await user.update({ primary_body_id: body.id });

            const res = await request({
                path: '/members/me/primary-body',
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: {}
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.primary_body_id).toBeNull();
            expect(res.body.data.primary_body).toBeNull();
            expect((await User.findByPk(user.id)).primary_body_id).toBeNull();
        });

        test('should keep the primary body if the new one is a body the member is not in', async () => {
            const body = await generator.createBody();
            const otherBody = await generator.createBody();
            const user = await generator.createUser();
            const token = await generator.createAccessToken(user);
            await generator.createBodyMembership(body, user);
            await user.update({ primary_body_id: body.id });

            const res = await request({
                path: '/members/me/primary-body',
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { primary_body_id: otherBody.id }
            });

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual({ success: false, message: 'User is not a member of this body.' });
            expect((await User.findByPk(user.id)).primary_body_id).toEqual(body.id);
        });

        test('should not take a join request for a membership', async () => {
            const body = await generator.createBody();
            const user = await generator.createUser();
            const token = await generator.createAccessToken(user);
            await generator.createJoinRequest(body, user);

            const res = await request({
                path: '/members/me/primary-body',
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { primary_body_id: body.id }
            });

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual({ success: false, message: 'User is not a member of this body.' });
            expect((await User.findByPk(user.id)).primary_body_id).toBeNull();
        });

        test('should keep the primary body if the new one does not exist', async () => {
            const body = await generator.createBody();
            const user = await generator.createUser();
            const token = await generator.createAccessToken(user);
            await generator.createBodyMembership(body, user);
            await user.update({ primary_body_id: body.id });

            const res = await request({
                path: '/members/me/primary-body',
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { primary_body_id: 2147483647 }
            });

            expect(res.statusCode).toEqual(404);
            expect(res.body).toEqual({ success: false, message: 'Body is not found.' });
            expect((await User.findByPk(user.id)).primary_body_id).toEqual(body.id);
        });

        test('should name the permission and keep the primary body of another member without it', async () => {
            const body = await generator.createBody();
            const user = await generator.createUser();
            const token = await generator.createAccessToken(user);

            const otherUser = await generator.createUser();
            await generator.createBodyMembership(body, otherUser);
            await otherUser.update({ primary_body_id: body.id });

            const res = await request({
                path: '/members/' + otherUser.id + '/primary-body',
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { primary_body_id: null }
            });

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual({ success: false, message: 'Permission update:member is required, but not present.' });
            expect((await User.findByPk(otherUser.id)).primary_body_id).toEqual(body.id);
        });
    });
});
