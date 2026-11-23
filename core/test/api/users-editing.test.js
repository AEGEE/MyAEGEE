const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { User } = require('../../models');

describe('User editing', () => {
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

        await generator.createPermission({ scope: 'global', action: 'update', object: 'member' });

        const res = await request({
            path: '/members/1337',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { username: 'test2' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if there are validation errors', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'member' });

        const res = await request({
            path: '/members/' + user.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { username: 'username with spaces' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('username');
    });

    test('should succeed if everything is okay', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'member' });

        const res = await request({
            path: '/members/' + user.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { username: 'test2' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.username).toEqual('test2');
    });

    test('should discard fields edited in other endpoints', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'member' });

        const res = await request({
            path: '/members/' + user.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { email: 'test@test.io' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.email).not.toEqual('test@test.io');
    });

    test('should work for current user for /me without permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members/' + user.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { username: 'test2' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.username).toEqual('test2');
    });

    test('should work for current user for /:user_id without permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members/' + user.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { username: 'test2' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.username).toEqual('test2');
    });

    test('should work with local permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const otherUser = await generator.createUser();
        const permission = await generator.createPermission({ scope: 'local', action: 'update', object: 'member' });
        const body = await generator.createBody();
        const circle = await generator.createCircle({ body_id: body.id });
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);
        await generator.createBodyMembership(body, otherUser);

        const res = await request({
            path: '/members/' + otherUser.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { username: 'test2' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.username).toEqual('test2');
    });

    describe('Google Workspace account', () => {
        const createGlobalManager = async () => {
            const manager = await generator.createUser();
            const permission = await generator.createPermission({ scope: 'global', action: 'update', object: 'member' });
            const circle = await generator.createCircle();
            await generator.createCircleMembership(circle, manager);
            await generator.createCirclePermission(circle, permission);

            return manager;
        };

        test('should be ignored on an own edit without the global permission', async () => {
            const user = await generator.createUser({ gsuite_id: 'own@aegee.eu' });
            const token = await generator.createAccessToken(user);

            const res = await request({
                path: '/members/' + user.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { first_name: 'Changed', gsuite_id: 'other@aegee.eu' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).not.toHaveProperty('errors');
            expect(res.body.data.first_name).toEqual('Changed');
            expect(res.body.data.gsuite_id).toEqual('own@aegee.eu');

            const userFromDb = await User.findByPk(user.id);
            expect(userFromDb.first_name).toEqual('Changed');
            expect(userFromDb.gsuite_id).toEqual('own@aegee.eu');
        });

        test('should not be set on an own edit without the global permission', async () => {
            const user = await generator.createUser();
            const token = await generator.createAccessToken(user);

            const res = await request({
                path: '/members/' + user.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { gsuite_id: 'new@aegee.eu' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body.data.gsuite_id).toBeNull();

            const userFromDb = await User.findByPk(user.id);
            expect(userFromDb.gsuite_id).toBeNull();
        });

        test('should not be removed on an own edit without the global permission', async () => {
            const user = await generator.createUser({ gsuite_id: 'own@aegee.eu' });
            const token = await generator.createAccessToken(user);

            const res = await request({
                path: '/members/' + user.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { gsuite_id: null }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);

            const userFromDb = await User.findByPk(user.id);
            expect(userFromDb.gsuite_id).toEqual('own@aegee.eu');
        });

        test('should be ignored for a holder of the local permission', async () => {
            const user = await generator.createUser();
            const token = await generator.createAccessToken(user);

            const otherUser = await generator.createUser();
            const permission = await generator.createPermission({ scope: 'local', action: 'update', object: 'member' });
            const body = await generator.createBody();
            const circle = await generator.createCircle({ body_id: body.id });
            await generator.createCircleMembership(circle, user);
            await generator.createCirclePermission(circle, permission);
            await generator.createBodyMembership(body, otherUser);

            const res = await request({
                path: '/members/' + otherUser.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { first_name: 'Changed', gsuite_id: 'new@aegee.eu' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body.data.first_name).toEqual('Changed');

            const userFromDb = await User.findByPk(otherUser.id);
            expect(userFromDb.first_name).toEqual('Changed');
            expect(userFromDb.gsuite_id).toBeNull();
        });

        test('should be saved for a holder of the global permission', async () => {
            const manager = await createGlobalManager();
            const token = await generator.createAccessToken(manager);
            const otherUser = await generator.createUser();

            const res = await request({
                path: '/members/' + otherUser.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { gsuite_id: 'New@AEGEE.eu' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body.data.gsuite_id).toEqual('new@aegee.eu');

            const userFromDb = await User.findByPk(otherUser.id);
            expect(userFromDb.gsuite_id).toEqual('new@aegee.eu');
        });

        test('should fail if it is not a valid email', async () => {
            const manager = await createGlobalManager();
            const token = await generator.createAccessToken(manager);
            const otherUser = await generator.createUser();

            const res = await request({
                path: '/members/' + otherUser.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { gsuite_id: 'not-an-email' }
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(res.body).not.toHaveProperty('data');
            expect(res.body.errors).toHaveProperty('gsuite_id');
        });

        test('should fail if it is not on one of the AEGEE domains', async () => {
            const manager = await createGlobalManager();
            const token = await generator.createAccessToken(manager);
            const otherUser = await generator.createUser();

            const res = await request({
                path: '/members/' + otherUser.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { gsuite_id: 'someone@example.com' }
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(res.body).not.toHaveProperty('data');
            expect(res.body.errors).toHaveProperty('gsuite_id');

            const userFromDb = await User.findByPk(otherUser.id);
            expect(userFromDb.gsuite_id).toBeNull();
        });

        test('should fail if another member already has it', async () => {
            const manager = await createGlobalManager();
            const token = await generator.createAccessToken(manager);
            const otherUser = await generator.createUser();
            await generator.createUser({ gsuite_id: 'taken@aegee.eu' });

            const res = await request({
                path: '/members/' + otherUser.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { gsuite_id: 'taken@aegee.eu' }
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(res.body).not.toHaveProperty('data');
            expect(res.body.errors).toHaveProperty('gsuite_id');
        });

        test('should not block an own edit when the stored value is not on one of the AEGEE domains', async () => {
            // A value from before the domain rule.
            const user = await User.create(generator.generateUser({ gsuite_id: 'legacy@example.com' }), { validate: false });
            const token = await generator.createAccessToken(user);

            const res = await request({
                path: '/members/' + user.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { first_name: 'Changed', gsuite_id: 'legacy@example.com' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body.data.first_name).toEqual('Changed');
        });

        describe('as the primary email', () => {
            const updateMember = (token, member, body) => request({
                path: '/members/' + member.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body
            });

            const expectPrimaryEmailRefused = (res) => {
                expect(res.statusCode).toEqual(422);
                expect(res.body.success).toEqual(false);
                expect(res.body).not.toHaveProperty('data');
                expect(res.body.errors).toEqual({
                    primary_email: ['The primary email can only be the Google Workspace account for a member who has one.']
                });
            };

            test('should be refused on an own edit of a member without a Google Workspace account', async () => {
                const user = await generator.createUser({ email: 'own@example.com' });
                const token = await generator.createAccessToken(user);

                const res = await updateMember(token, user, { first_name: 'Changed', primary_email: 'gsuite' });
                expectPrimaryEmailRefused(res);

                const userFromDb = await User.findByPk(user.id);
                expect(userFromDb.primary_email).toEqual('personal');
                expect(userFromDb.notification_email).toEqual('own@example.com');
                expect(userFromDb.first_name).not.toEqual('Changed');
            });

            test('should be refused for a holder of the local permission if the member has no Google Workspace account', async () => {
                const user = await generator.createUser();
                const token = await generator.createAccessToken(user);

                const otherUser = await generator.createUser({ email: 'member@example.com' });
                const permission = await generator.createPermission({ scope: 'local', action: 'update', object: 'member' });
                const body = await generator.createBody();
                const circle = await generator.createCircle({ body_id: body.id });
                await generator.createCircleMembership(circle, user);
                await generator.createCirclePermission(circle, permission);
                await generator.createBodyMembership(body, otherUser);

                // The account in the request is ignored without the global permission.
                const res = await updateMember(token, otherUser, { gsuite_id: 'new@aegee.eu', primary_email: 'gsuite' });
                expectPrimaryEmailRefused(res);

                const userFromDb = await User.findByPk(otherUser.id);
                expect(userFromDb.primary_email).toEqual('personal');
                expect(userFromDb.gsuite_id).toBeNull();
                expect(userFromDb.notification_email).toEqual('member@example.com');
            });

            test('should be refused for a holder of the global permission if the member has no Google Workspace account', async () => {
                const manager = await createGlobalManager();
                const token = await generator.createAccessToken(manager);
                const otherUser = await generator.createUser();

                const res = await updateMember(token, otherUser, { primary_email: 'gsuite' });
                expectPrimaryEmailRefused(res);

                const userFromDb = await User.findByPk(otherUser.id);
                expect(userFromDb.primary_email).toEqual('personal');
            });

            test('should be saved on an own edit of a member with a Google Workspace account', async () => {
                const user = await generator.createUser({ gsuite_id: 'own@aegee.eu' });
                const token = await generator.createAccessToken(user);

                const res = await updateMember(token, user, { primary_email: 'gsuite' });

                expect(res.statusCode).toEqual(200);
                expect(res.body.success).toEqual(true);
                expect(res.body.data.primary_email).toEqual('gsuite');
                expect(res.body.data.notification_email).toEqual('own@aegee.eu');

                const userFromDb = await User.findByPk(user.id);
                expect(userFromDb.primary_email).toEqual('gsuite');
            });

            test('should be saved together with the Google Workspace account by a holder of the global permission', async () => {
                const manager = await createGlobalManager();
                const token = await generator.createAccessToken(manager);
                const otherUser = await generator.createUser();

                const res = await updateMember(token, otherUser, { gsuite_id: 'new@aegee.eu', primary_email: 'gsuite' });

                expect(res.statusCode).toEqual(200);
                expect(res.body.success).toEqual(true);
                expect(res.body.data.notification_email).toEqual('new@aegee.eu');
            });

            test('should keep the Google Workspace account from being removed while it is the primary email', async () => {
                const manager = await createGlobalManager();
                const token = await generator.createAccessToken(manager);
                const otherUser = await generator.createUser({ gsuite_id: 'member@aegee.eu', primary_email: 'gsuite' });

                const res = await updateMember(token, otherUser, { gsuite_id: null });
                expectPrimaryEmailRefused(res);

                const userFromDb = await User.findByPk(otherUser.id);
                expect(userFromDb.gsuite_id).toEqual('member@aegee.eu');
                expect(userFromDb.primary_email).toEqual('gsuite');
            });

            test('should allow removing the Google Workspace account when the primary email becomes the login email', async () => {
                const manager = await createGlobalManager();
                const token = await generator.createAccessToken(manager);
                const otherUser = await generator.createUser({
                    email: 'member@example.com',
                    gsuite_id: 'member@aegee.eu',
                    primary_email: 'gsuite'
                });

                const res = await updateMember(token, otherUser, { gsuite_id: null, primary_email: 'personal' });

                expect(res.statusCode).toEqual(200);
                expect(res.body.success).toEqual(true);
                expect(res.body.data.gsuite_id).toBeNull();
                expect(res.body.data.notification_email).toEqual('member@example.com');
            });

            test('should not block other edits of a member who has it without a Google Workspace account', async () => {
                const user = await generator.createUser({ primary_email: 'gsuite' });
                const token = await generator.createAccessToken(user);

                const res = await updateMember(token, user, { first_name: 'Changed', primary_email: 'gsuite' });

                expect(res.statusCode).toEqual(200);
                expect(res.body.success).toEqual(true);
                expect(res.body.data.first_name).toEqual('Changed');

                const back = await updateMember(token, user, { primary_email: 'personal' });

                expect(back.statusCode).toEqual(200);
                expect(back.body.data.primary_email).toEqual('personal');
            });
        });
    });

    test('should fail if no permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const otherUser = await generator.createUser();

        const res = await request({
            path: '/members/' + otherUser.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { username: 'test2' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });
});
