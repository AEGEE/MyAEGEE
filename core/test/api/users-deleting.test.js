const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { User, CircleMembership, BodyMembership } = require('../../models');

describe('User deleting', () => {
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

        await generator.createPermission({ scope: 'global', action: 'delete', object: 'member' });

        const res = await request({
            path: '/members/2147483647',
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed if everything is okay', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'delete', object: 'member' });

        const res = await request({
            path: '/members/' + user.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        const userFromDb = await User.findByPk(user.id);
        expect(userFromDb).toEqual(null);
    });

    test('should fail if no permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const otherUser = await generator.createUser();

        const res = await request({
            path: '/members/' + otherUser.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should delete linked things', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'delete', object: 'member' });

        const body = await generator.createBody();
        const circle = await generator.createCircle();
        await generator.createBodyMembership(body, user);
        await generator.createCircleMembership(circle, user);

        const res = await request({
            path: '/members/' + user.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        const userFromDb = await User.findByPk(user.id);
        expect(userFromDb).toEqual(null);

        const bodyMembershipsCount = await BodyMembership.count({ where: { user_id: user.id } });
        expect(bodyMembershipsCount).toEqual(0);

        const circleMembershipsCount = await CircleMembership.count({ where: { user_id: user.id } });
        expect(circleMembershipsCount).toEqual(0);
    });

    test('should delete the member, and nobody else', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);
        await generator.createPermission({ scope: 'global', action: 'delete', object: 'member' });

        const member = await generator.createUser();
        const otherMember = await generator.createUser();

        const res = await request({
            path: '/members/' + member.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual({ success: true, message: 'User is deleted.' });

        const users = await User.findAll({ order: [['id', 'ASC']] });
        expect(users.map((item) => item.id)).toEqual([user.id, otherMember.id].sort((a, b) => a - b));
    });

    test('should find the member to delete by username', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);
        await generator.createPermission({ scope: 'global', action: 'delete', object: 'member' });

        const member = await generator.createUser({ username: 'someone' });

        const res = await request({
            path: '/members/SomeOne',
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(await User.findByPk(member.id)).toBeNull();
    });

    test('should end the sessions of the deleted member', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);
        await generator.createPermission({ scope: 'global', action: 'delete', object: 'member' });

        const member = await generator.createUser();
        const memberToken = await generator.createAccessToken(member);
        const memberRefreshToken = await generator.createRefreshToken(member);

        await request({
            path: '/members/' + member.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value }
        });

        const res = await request({
            path: '/members/me',
            method: 'GET',
            headers: { 'X-Auth-Token': memberToken.value }
        });
        expect(res.statusCode).toEqual(401);

        const renewed = await request({
            path: '/renew',
            method: 'POST',
            body: { refresh_token: memberRefreshToken.value }
        });
        expect(renewed.statusCode).toEqual(403);
    });

    test('should answer 404 for a member who is deleted already', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);
        await generator.createPermission({ scope: 'global', action: 'delete', object: 'member' });

        const member = await generator.createUser();
        const remove = () => request({
            path: '/members/' + member.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value }
        });

        expect((await remove()).statusCode).toEqual(200);

        const res = await remove();
        expect(res.statusCode).toEqual(404);
        expect(res.body).toEqual({ success: false, message: 'User is not found.' });
    });

    test.each(['themselves', 'another member'])('should name the permission and keep the member for %s without it', async (who) => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);
        const member = who === 'themselves' ? user : await generator.createUser();

        const res = await request({
            path: '/members/' + (who === 'themselves' ? 'me' : member.id),
            method: 'DELETE',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body).toEqual({ success: false, message: 'Permission delete:member is required, but not present.' });
        expect(await User.findByPk(member.id)).not.toBeNull();
    });

    describe('with the local permission', () => {
        const createLocalManager = async (body) => {
            const manager = await generator.createUser();
            const permission = await generator.createPermission({ scope: 'local', action: 'delete', object: 'member' });
            const circle = await generator.createCircle({ body_id: body.id });
            await generator.createCircleMembership(circle, manager);
            await generator.createCirclePermission(circle, permission);

            return generator.createAccessToken(manager);
        };

        test('should delete a member of that body', async () => {
            const body = await generator.createBody();
            const token = await createLocalManager(body);
            const member = await generator.createUser();
            await generator.createBodyMembership(body, member);

            const res = await request({
                path: '/members/' + member.id,
                method: 'DELETE',
                headers: { 'X-Auth-Token': token.value }
            });

            expect(res.statusCode).toEqual(200);
            expect(await User.findByPk(member.id)).toBeNull();
        });

        test('should keep a member of another body', async () => {
            const body = await generator.createBody();
            const otherBody = await generator.createBody();
            const token = await createLocalManager(body);
            const member = await generator.createUser();
            await generator.createBodyMembership(otherBody, member);

            const res = await request({
                path: '/members/' + member.id,
                method: 'DELETE',
                headers: { 'X-Auth-Token': token.value }
            });

            expect(res.statusCode).toEqual(403);
            expect(await User.findByPk(member.id)).not.toBeNull();
        });
    });
});
