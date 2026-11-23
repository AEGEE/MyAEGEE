const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { User } = require('../../models');

describe('User activation', () => {
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
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update_active', object: 'user' });

        const res = await request({
            path: '/members/2147483647/active',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { active: false }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if there are validation errors', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);
        const otherUser = await generator.createUser();

        await generator.createPermission({ scope: 'global', action: 'update_active', object: 'user' });

        const res = await request({
            path: '/members/' + otherUser.id + '/active',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { active: 'aaa' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('active');
    });

    test('should succeed if everything is okay', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);
        const otherUser = await generator.createUser();

        await generator.createPermission({ scope: 'global', action: 'update_active', object: 'user' });

        const res = await request({
            path: '/members/' + otherUser.id + '/active',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { active: false }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.active).toEqual(false);
    });

    test('should fail for yourself without permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members/' + user.id + '/active',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { active: false }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail with only the local permission, for a member of the same body', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const otherUser = await generator.createUser();
        const permission = await generator.createPermission({ scope: 'local', action: 'update_active', object: 'user' });
        const body = await generator.createBody();
        const circle = await generator.createCircle({ body_id: body.id });
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);
        await generator.createBodyMembership(body, otherUser);

        const res = await request({
            path: '/members/' + otherUser.id + '/active',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { active: false }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.message).toEqual('Permission global:update_active:user is required, but not present.');

        const userFromDb = await User.findByPk(otherUser.id);
        expect(userFromDb.active).toEqual(true);
    });

    test('should fail for other person without permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const otherUser = await generator.createUser();

        const res = await request({
            path: '/members/' + otherUser.id + '/active',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { active: false }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should work with the global permission of a circle', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const otherUser = await generator.createUser();
        const permission = await generator.createPermission({ scope: 'global', action: 'update_active', object: 'user' });
        const circle = await generator.createCircle();
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);

        const res = await request({
            path: '/members/' + otherUser.id + '/active',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { active: false }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.active).toEqual(false);

        const userFromDb = await User.findByPk(otherUser.id);
        expect(userFromDb.active).toEqual(false);
    });

    test('should lift a suspension', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const otherUser = await generator.createUser({ active: false });
        const permission = await generator.createPermission({ scope: 'global', action: 'update_active', object: 'user' });
        const circle = await generator.createCircle();
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);

        const res = await request({
            path: '/members/' + otherUser.id + '/active',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { active: true }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.active).toEqual(true);
    });

    test('should fail with a permission of another name', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const otherUser = await generator.createUser();
        const permission = await generator.createPermission({ scope: 'global', action: 'update_active', object: 'member' });
        const circle = await generator.createCircle();
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);

        const res = await request({
            path: '/members/' + otherUser.id + '/active',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { active: false }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.message).toEqual('Permission global:update_active:user is required, but not present.');

        const userFromDb = await User.findByPk(otherUser.id);
        expect(userFromDb.active).toEqual(true);
    });

    test('should fail with the local permission for a member of another body', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const otherUser = await generator.createUser();
        const permission = await generator.createPermission({ scope: 'local', action: 'update_active', object: 'user' });
        const body = await generator.createBody();
        const otherBody = await generator.createBody();
        const circle = await generator.createCircle({ body_id: body.id });
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);
        await generator.createBodyMembership(otherBody, otherUser);

        const res = await request({
            path: '/members/' + otherUser.id + '/active',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { active: false }
        });

        expect(res.statusCode).toEqual(403);

        const userFromDb = await User.findByPk(otherUser.id);
        expect(userFromDb.active).toEqual(true);
    });

    test('should end the sessions of the suspended member at their next request', async () => {
        const admin = await generator.createUser({ superadmin: true });
        const adminToken = await generator.createAccessToken(admin);
        await generator.createPermission({ scope: 'global', action: 'update_active', object: 'user' });

        const member = await generator.createUser();
        const memberToken = await generator.createAccessToken(member);
        const memberRefreshToken = await generator.createRefreshToken(member);

        const before = await request({ path: '/members/me', headers: { 'X-Auth-Token': memberToken.value } });
        expect(before.statusCode).toEqual(200);

        const res = await request({
            path: '/members/' + member.id + '/active',
            method: 'PUT',
            headers: { 'X-Auth-Token': adminToken.value },
            body: { active: false }
        });
        expect(res.statusCode).toEqual(200);

        const after = await request({ path: '/members/me', headers: { 'X-Auth-Token': memberToken.value } });
        expect(after.statusCode).toEqual(401);

        const renewal = await request({
            path: '/renew',
            method: 'POST',
            body: { refresh_token: memberRefreshToken.value }
        });
        expect(renewal.statusCode).toEqual(403);
    });

    describe('who can be suspended', () => {
        const createSuspender = async () => {
            const user = await generator.createUser();
            const token = await generator.createAccessToken(user);
            const permission = await generator.createPermission({ scope: 'global', action: 'update_active', object: 'user' });
            const circle = await generator.createCircle();
            await generator.createCircleMembership(circle, user);
            await generator.createCirclePermission(circle, permission);
            return { user, token };
        };

        const setActive = (token, userId, active) => request({
            path: '/members/' + userId + '/active',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { active }
        });

        test('should refuse suspending yourself', async () => {
            const { user, token } = await createSuspender();

            const res = await setActive(token, user.id, false);

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(res.body.message).toEqual('You cannot suspend yourself.');

            const userFromDb = await User.findByPk(user.id);
            expect(userFromDb.active).toEqual(true);
        });

        test('should refuse suspending yourself through /members/me', async () => {
            const { user, token } = await createSuspender();

            const res = await setActive(token, 'me', false);

            expect(res.statusCode).toEqual(422);
            expect(res.body.message).toEqual('You cannot suspend yourself.');

            const userFromDb = await User.findByPk(user.id);
            expect(userFromDb.active).toEqual(true);
        });

        // A suspended member is not logged in, so whoever reaches the route is active already.
        test('should answer activating yourself without changing anything', async () => {
            const { user, token } = await createSuspender();

            for (const id of [user.id, 'me']) {
                const res = await setActive(token, id, true);

                expect(res.statusCode).toEqual(200);
                expect(res.body.success).toEqual(true);
                expect(res.body.data.id).toEqual(user.id);
            }

            const userFromDb = await User.findByPk(user.id);
            expect(userFromDb.active).toEqual(true);
        });

        test('should refuse a superadmin suspending themselves', async () => {
            const admin = await generator.createUser({ superadmin: true });
            const token = await generator.createAccessToken(admin);
            await generator.createPermission({ scope: 'global', action: 'update_active', object: 'user' });

            const res = await setActive(token, admin.id, false);

            expect(res.statusCode).toEqual(422);
            expect(res.body.message).toEqual('You cannot suspend yourself.');

            const userFromDb = await User.findByPk(admin.id);
            expect(userFromDb.active).toEqual(true);
        });

        test('should refuse suspending a superadmin to somebody who is not one', async () => {
            const { token } = await createSuspender();
            const admin = await generator.createUser({ superadmin: true });

            const res = await setActive(token, admin.id, false);

            expect(res.statusCode).toEqual(403);
            expect(res.body.success).toEqual(false);
            expect(res.body.message).toEqual('Only a superadmin can suspend or activate a superadmin.');

            const userFromDb = await User.findByPk(admin.id);
            expect(userFromDb.active).toEqual(true);
        });

        test('should refuse activating a superadmin to somebody who is not one', async () => {
            const { token } = await createSuspender();
            const admin = await generator.createUser({ superadmin: true, active: false });

            const res = await setActive(token, admin.id, true);

            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toEqual('Only a superadmin can suspend or activate a superadmin.');

            const userFromDb = await User.findByPk(admin.id);
            expect(userFromDb.active).toEqual(false);
        });

        test('should let a superadmin suspend another superadmin', async () => {
            const admin = await generator.createUser({ superadmin: true });
            const token = await generator.createAccessToken(admin);
            await generator.createPermission({ scope: 'global', action: 'update_active', object: 'user' });
            const otherAdmin = await generator.createUser({ superadmin: true });

            const res = await setActive(token, otherAdmin.id, false);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.active).toEqual(false);

            const userFromDb = await User.findByPk(otherAdmin.id);
            expect(userFromDb.active).toEqual(false);
        });
    });

    describe('what is stored', () => {
        const createManager = async () => {
            const manager = await generator.createUser({ superadmin: true });
            await generator.createPermission({ scope: 'global', action: 'update_active', object: 'user' });

            return generator.createAccessToken(manager);
        };

        test('should suspend the member, and nobody else', async () => {
            const token = await createManager();
            const member = await generator.createUser();
            const otherMember = await generator.createUser();

            const res = await request({
                path: '/members/' + member.id + '/active',
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { active: false }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.id).toEqual(member.id);
            expect(res.body.data.active).toEqual(false);
            expect(res.body.data).not.toHaveProperty('password');

            expect((await User.findByPk(member.id)).active).toEqual(false);
            expect((await User.findByPk(otherMember.id)).active).toEqual(true);
        });

        test('should change nothing without the field', async () => {
            const token = await createManager();
            const member = await generator.createUser({ active: false });

            const res = await request({
                path: '/members/' + member.id + '/active',
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: {}
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.active).toEqual(false);
            expect((await User.findByPk(member.id)).active).toEqual(false);
        });

        test('should ignore the other fields of a member', async () => {
            const token = await createManager();
            const member = await generator.createUser({ first_name: 'Some' });

            const res = await request({
                path: '/members/' + member.id + '/active',
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { active: false, superadmin: true, first_name: 'Changed' }
            });

            expect(res.statusCode).toEqual(200);

            const fromDb = await User.findByPk(member.id);
            expect(fromDb.active).toEqual(false);
            expect(fromDb.superadmin).toEqual(false);
            expect(fromDb.first_name).toEqual('Some');
        });

        test('should name the rule for a value that is not yes or no, and keep the member active', async () => {
            const token = await createManager();
            const member = await generator.createUser();

            const res = await request({
                path: '/members/' + member.id + '/active',
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { active: 'aaa' }
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body).toEqual({ success: false, errors: { active: ['Active should be valid.'] } });
            expect((await User.findByPk(member.id)).active).toEqual(true);
        });

        test.each(['themselves', 'another member'])('should name the permission and keep the member active for %s without it', async (who) => {
            const user = await generator.createUser();
            const token = await generator.createAccessToken(user);
            const member = who === 'themselves' ? user : await generator.createUser();

            const res = await request({
                path: '/members/' + member.id + '/active',
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { active: false }
            });

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual({ success: false, message: 'Permission global:update_active:user is required, but not present.' });
            expect((await User.findByPk(member.id)).active).toEqual(true);
        });
    });
});
