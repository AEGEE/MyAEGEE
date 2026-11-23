const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { User } = require('../../models');

describe('User superadmin', () => {
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

        await generator.createPermission({ scope: 'global', action: 'update_superadmin', object: 'member' });

        const res = await request({
            path: '/members/1337/superadmin',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { superadmin: false }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if there are validation errors', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update_superadmin', object: 'member' });

        const res = await request({
            path: '/members/' + user.id + '/superadmin',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { superadmin: 'aaa' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('superadmin');
    });

    test('should succeed if everything is okay', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update_superadmin', object: 'member' });

        const res = await request({
            path: '/members/' + user.id + '/superadmin',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { superadmin: false }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.superadmin).toEqual(false);
    });

    test('should fail for yourself without permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members/' + user.id + '/superadmin',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { superadmin: true }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should not work with local permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const otherUser = await generator.createUser();
        const permission = await generator.createPermission({ scope: 'local', action: 'update_superadmin', object: 'member' });
        const body = await generator.createBody();
        const circle = await generator.createCircle({ body_id: body.id });
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);
        await generator.createBodyMembership(body, otherUser);

        const res = await request({
            path: '/members/' + otherUser.id + '/superadmin',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { superadmin: true }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail for other person without permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const otherUser = await generator.createUser();

        const res = await request({
            path: '/members/' + otherUser.id + '/superadmin',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { superadmin: true }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    describe('what is stored', () => {
        const createManager = async () => {
            const manager = await generator.createUser({ superadmin: true });
            await generator.createPermission({ scope: 'global', action: 'update_superadmin', object: 'member' });

            return generator.createAccessToken(manager);
        };

        test('should make the member a superadmin, and nobody else', async () => {
            const token = await createManager();
            const member = await generator.createUser();
            const otherMember = await generator.createUser();

            const res = await request({
                path: '/members/' + member.id + '/superadmin',
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { superadmin: true }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.id).toEqual(member.id);
            expect(res.body.data.superadmin).toEqual(true);

            expect((await User.findByPk(member.id)).superadmin).toEqual(true);
            expect((await User.findByPk(otherMember.id)).superadmin).toEqual(false);
        });

        test('should take it away again', async () => {
            const token = await createManager();
            const member = await generator.createUser({ superadmin: true });

            const res = await request({
                path: '/members/' + member.id + '/superadmin',
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { superadmin: false }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.superadmin).toEqual(false);
            expect((await User.findByPk(member.id)).superadmin).toEqual(false);
        });

        test('should change nothing without the field', async () => {
            const token = await createManager();
            const member = await generator.createUser();

            const res = await request({
                path: '/members/' + member.id + '/superadmin',
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: {}
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.superadmin).toEqual(false);
            expect((await User.findByPk(member.id)).superadmin).toEqual(false);
        });

        test('should ignore the other fields of a member', async () => {
            const token = await createManager();
            const member = await generator.createUser({ first_name: 'Some' });

            const res = await request({
                path: '/members/' + member.id + '/superadmin',
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { superadmin: true, active: false, first_name: 'Changed' }
            });

            expect(res.statusCode).toEqual(200);

            const fromDb = await User.findByPk(member.id);
            expect(fromDb.superadmin).toEqual(true);
            expect(fromDb.active).toEqual(true);
            expect(fromDb.first_name).toEqual('Some');
        });

        test('should name the rule for a value that is not yes or no, and change nothing', async () => {
            const token = await createManager();
            const member = await generator.createUser();

            const res = await request({
                path: '/members/' + member.id + '/superadmin',
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { superadmin: 'aaa' }
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body).toEqual({ success: false, errors: { superadmin: ['Superadmin should be valid.'] } });
            expect((await User.findByPk(member.id)).superadmin).toEqual(false);
        });

        test.each(['themselves', 'another member'])('should name the permission and change nothing for %s without it', async (who) => {
            const user = await generator.createUser();
            const token = await generator.createAccessToken(user);
            const member = who === 'themselves' ? user : await generator.createUser();

            const res = await request({
                path: '/members/' + member.id + '/superadmin',
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { superadmin: true }
            });

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual({
                success: false,
                message: 'Permission global:update_superadmin:member is required, but not present.'
            });
            expect((await User.findByPk(member.id)).superadmin).toEqual(false);
        });
    });
});
