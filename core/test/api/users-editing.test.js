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
            path: '/members/2147483647',
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

    test('should not repeat the sent names in the validation messages', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members/me',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { first_name: 'Some1', last_name: 'Other2' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.errors).toEqual({
            first_name: ['First name should only contain letters, spaces and dashes.'],
            last_name: ['Last name should only contain letters, spaces and dashes.']
        });
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
            const user = await generator.createUser({ gsuite_id: 'example-own@aegee.eu' });
            const token = await generator.createAccessToken(user);

            const res = await request({
                path: '/members/' + user.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { first_name: 'Changed', gsuite_id: 'example-other@aegee.eu' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).not.toHaveProperty('errors');
            expect(res.body.data.first_name).toEqual('Changed');
            expect(res.body.data.gsuite_id).toEqual('example-own@aegee.eu');

            const userFromDb = await User.findByPk(user.id);
            expect(userFromDb.first_name).toEqual('Changed');
            expect(userFromDb.gsuite_id).toEqual('example-own@aegee.eu');
        });

        test('should not be set on an own edit without the global permission', async () => {
            const user = await generator.createUser();
            const token = await generator.createAccessToken(user);

            const res = await request({
                path: '/members/' + user.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { gsuite_id: 'example-new@aegee.eu' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body.data.gsuite_id).toBeNull();

            const userFromDb = await User.findByPk(user.id);
            expect(userFromDb.gsuite_id).toBeNull();
        });

        test('should not be removed on an own edit without the global permission', async () => {
            const user = await generator.createUser({ gsuite_id: 'example-own@aegee.eu' });
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
            expect(userFromDb.gsuite_id).toEqual('example-own@aegee.eu');
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
                body: { first_name: 'Changed', gsuite_id: 'example-new@aegee.eu' }
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
                body: { gsuite_id: 'example-New@AEGEE.eu' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body.data.gsuite_id).toEqual('example-new@aegee.eu');

            const userFromDb = await User.findByPk(otherUser.id);
            expect(userFromDb.gsuite_id).toEqual('example-new@aegee.eu');
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
            await generator.createUser({ gsuite_id: 'example-taken@aegee.eu' });

            const res = await request({
                path: '/members/' + otherUser.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { gsuite_id: 'example-taken@aegee.eu' }
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
                const res = await updateMember(token, otherUser, { gsuite_id: 'example-new@aegee.eu', primary_email: 'gsuite' });
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
                const user = await generator.createUser({ gsuite_id: 'example-own@aegee.eu' });
                const token = await generator.createAccessToken(user);

                const res = await updateMember(token, user, { primary_email: 'gsuite' });

                expect(res.statusCode).toEqual(200);
                expect(res.body.success).toEqual(true);
                expect(res.body.data.primary_email).toEqual('gsuite');
                expect(res.body.data.notification_email).toEqual('example-own@aegee.eu');

                const userFromDb = await User.findByPk(user.id);
                expect(userFromDb.primary_email).toEqual('gsuite');
            });

            test('should be saved together with the Google Workspace account by a holder of the global permission', async () => {
                const manager = await createGlobalManager();
                const token = await generator.createAccessToken(manager);
                const otherUser = await generator.createUser();

                const res = await updateMember(token, otherUser, { gsuite_id: 'example-new@aegee.eu', primary_email: 'gsuite' });

                expect(res.statusCode).toEqual(200);
                expect(res.body.success).toEqual(true);
                expect(res.body.data.notification_email).toEqual('example-new@aegee.eu');
            });

            test('should keep the Google Workspace account from being removed while it is the primary email', async () => {
                const manager = await createGlobalManager();
                const token = await generator.createAccessToken(manager);
                const otherUser = await generator.createUser({ gsuite_id: 'example-member@aegee.eu', primary_email: 'gsuite' });

                const res = await updateMember(token, otherUser, { gsuite_id: null });
                expectPrimaryEmailRefused(res);

                const userFromDb = await User.findByPk(otherUser.id);
                expect(userFromDb.gsuite_id).toEqual('example-member@aegee.eu');
                expect(userFromDb.primary_email).toEqual('gsuite');
            });

            test('should allow removing the Google Workspace account when the primary email becomes the login email', async () => {
                const manager = await createGlobalManager();
                const token = await generator.createAccessToken(manager);
                const otherUser = await generator.createUser({
                    email: 'member@example.com',
                    gsuite_id: 'example-member@aegee.eu',
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

    describe('fields that have their own route', () => {
        const OTHER_FIELDS = {
            id: 2147483647,
            email: 'changed@example.com',
            password: 'a-changed-password',
            active: false,
            superadmin: true,
            mail_confirmed_at: null,
            primary_body_id: 2147483647,
            image: 'changed.png',
            campaign_id: 2147483647,
            last_logged_in: '2001-01-01T00:00:00.000Z',
            created_at: '2001-01-01T00:00:00.000Z'
        };

        const expectUnchanged = async (member) => {
            const fromDb = await User.scope('withPassword').findByPk(member.id);

            expect(fromDb).not.toBeNull();
            expect(fromDb.email).toEqual('some.one@example.com');
            expect(await fromDb.checkPassword('the-old-password')).toEqual(true);
            expect(fromDb.active).toEqual(true);
            expect(fromDb.superadmin).toEqual(false);
            expect(fromDb.mail_confirmed_at).not.toBeNull();
            expect(fromDb.primary_body_id).toBeNull();
            expect(fromDb.image).toBeNull();
            expect(fromDb.campaign_id).toBeNull();
            expect(fromDb.last_logged_in).toBeNull();
            expect(fromDb.created_at.getTime()).toEqual(member.created_at.getTime());
            expect(await User.findByPk(2147483647)).toBeNull();

            return fromDb;
        };

        test('should be ignored on an own edit, while the profile fields are saved', async () => {
            const user = await generator.createUser({ email: 'some.one@example.com', password: 'the-old-password' });
            const token = await generator.createAccessToken(user);

            const res = await request({
                path: '/members/me',
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { ...OTHER_FIELDS, first_name: 'Changed' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.id).toEqual(user.id);
            expect(res.body.data.first_name).toEqual('Changed');
            expect(res.body.data.email).toEqual('some.one@example.com');
            expect(res.body.data.superadmin).toEqual(false);
            expect(res.body.data.active).toEqual(true);
            expect(res.body.data).not.toHaveProperty('password');

            const fromDb = await expectUnchanged(user);
            expect(fromDb.first_name).toEqual('Changed');
        });

        test('should be ignored for a holder of the global permission', async () => {
            const manager = await generator.createUser({ superadmin: true });
            const token = await generator.createAccessToken(manager);
            await generator.createPermission({ scope: 'global', action: 'update', object: 'member' });

            const member = await generator.createUser({ email: 'some.one@example.com', password: 'the-old-password' });

            const res = await request({
                path: '/members/' + member.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { ...OTHER_FIELDS, last_name: 'Changed' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.id).toEqual(member.id);
            expect(res.body.data.last_name).toEqual('Changed');

            const fromDb = await expectUnchanged(member);
            expect(fromDb.last_name).toEqual('Changed');
        });

        test('should keep the sessions of the member', async () => {
            const user = await generator.createUser({ email: 'some.one@example.com', password: 'the-old-password' });
            const token = await generator.createAccessToken(user);

            await request({
                path: '/members/me',
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { ...OTHER_FIELDS, first_name: 'Changed' }
            });

            const res = await request({
                path: '/members/me',
                method: 'GET',
                headers: { 'X-Auth-Token': token.value }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.first_name).toEqual('Changed');
        });
    });

    describe('what is stored', () => {
        test('should save every profile field, and answer with the member as stored', async () => {
            const user = await generator.createUser();
            const token = await generator.createAccessToken(user);

            const res = await request({
                path: '/members/me',
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: {
                    username: ' New.Name ',
                    first_name: ' Some ',
                    last_name: ' One ',
                    date_of_birth: '1995-03-17',
                    gender: ' other ',
                    phone: ' +31 6 12345678 ',
                    privacy_consent: '2026-01-02T03:04:05.000Z',
                    address: ' Somewhere 1 ',
                    about_me: ' Something about me. '
                }
            });

            const expected = {
                username: 'new.name',
                first_name: 'Some',
                last_name: 'One',
                date_of_birth: '1995-03-17',
                gender: 'other',
                phone: '+31 6 12345678',
                address: 'Somewhere 1',
                about_me: 'Something about me.'
            };

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toEqual(expect.objectContaining({
                ...expected,
                id: user.id,
                privacy_consent: '2026-01-02T03:04:05.000Z'
            }));

            const fromDb = await User.findByPk(user.id);
            expect(fromDb).toEqual(expect.objectContaining(expected));
            expect(fromDb.privacy_consent.toISOString()).toEqual('2026-01-02T03:04:05.000Z');
        });

        test('should only change the fields that are sent', async () => {
            const user = await generator.createUser({ phone: '+31 6 12345678', gender: 'other' });
            const token = await generator.createAccessToken(user);

            const res = await request({
                path: '/members/me',
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { about_me: 'Something else.' }
            });

            expect(res.statusCode).toEqual(200);

            const fromDb = await User.findByPk(user.id);
            expect(fromDb.about_me).toEqual('Something else.');
            for (const field of ['username', 'first_name', 'last_name', 'date_of_birth', 'gender', 'phone', 'address', 'primary_email']) {
                expect(fromDb[field]).toEqual(user[field]);
            }
        });

        test('should unset the birthday with an empty text', async () => {
            const user = await generator.createUser({ date_of_birth: '1995-03-17' });
            const token = await generator.createAccessToken(user);

            const res = await request({
                path: '/members/me',
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { date_of_birth: '' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.date_of_birth).toBeNull();

            const fromDb = await User.findByPk(user.id);
            expect(fromDb.date_of_birth).toBeNull();
        });
    });

    describe('values that are not valid', () => {
        test.each([
            ['username', 'user name', 'Username should only contain letters, numbers, dots, underscores and dashes.'],
            ['username', '1234', 'Username should have at least 1 letter.'],
            ['username', '', 'Username should be set.'],
            ['first_name', 'Some1', 'First name should only contain letters, spaces and dashes, got "Some1".'],
            ['first_name', '', 'First name should be set.'],
            ['last_name', 'One!', 'Last name should only contain letters, spaces and dashes, got "One!".'],
            ['last_name', '', 'Last name should be set.'],
            ['date_of_birth', '2999-01-01', 'Birthday should be in the past.'],
            ['primary_email', 'work', 'Primary email should be one of these: "personal", "gsuite".']
        ])('should name the rule for %s "%s", and change nothing', async (field, value, message) => {
            const user = await generator.createUser();
            const token = await generator.createAccessToken(user);

            const res = await request({
                path: '/members/me',
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { about_me: 'Something else.', [field]: value }
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(Object.keys(res.body.errors)).toEqual([field]);
            expect(res.body.errors[field]).toContain(message);

            const fromDb = await User.findByPk(user.id);
            expect(fromDb[field]).toEqual(user[field]);
            expect(fromDb.about_me).toEqual(user.about_me);
        });

        test.each([
            ['the same', 'taken'],
            ['in another case', 'Taken'],
            ['with spaces around it', ' taken ']
        ])('should fail if the username is taken by another member (%s)', async (name, username) => {
            await generator.createUser({ username: 'taken' });
            const user = await generator.createUser({ username: 'someone' });
            const token = await generator.createAccessToken(user);

            const res = await request({
                path: '/members/me',
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { username }
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body).toEqual({ success: false, errors: { username: ['username must be unique'] } });

            const fromDb = await User.findByPk(user.id);
            expect(fromDb.username).toEqual('someone');
        });

        test('should accept the own username in another case', async () => {
            const user = await generator.createUser({ username: 'someone' });
            const token = await generator.createAccessToken(user);

            const res = await request({
                path: '/members/me',
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { username: 'SomeOne' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.username).toEqual('someone');
        });
    });

    describe('Google Workspace account that is not valid', () => {
        const createGlobalManager = async () => {
            const manager = await generator.createUser();
            const permission = await generator.createPermission({ scope: 'global', action: 'update', object: 'member' });
            const circle = await generator.createCircle();
            await generator.createCircleMembership(circle, manager);
            await generator.createCirclePermission(circle, permission);

            return manager;
        };

        const setAccount = async (member, value) => {
            const manager = await createGlobalManager();
            const token = await generator.createAccessToken(manager);

            return request({
                path: '/members/' + member.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { gsuite_id: value }
            });
        };

        test.each([
            ['not an email', 'not-an-email', ['GSuite ID should be a valid email.', 'GSuite ID should be in one of the following domains: aegee.org, aegee.eu.']],
            ['empty', '', ['GSuite ID should be a valid email.', 'GSuite ID should be in one of the following domains: aegee.org, aegee.eu.']],
            ['on another domain', 'some.one@example.com', ['GSuite ID should be in one of the following domains: aegee.org, aegee.eu.']],
            ['a domain without a name', '@aegee.eu', ['GSuite ID should be a valid email.']]
        ])('should name the rule if it is %s, and keep the stored one', async (name, value, messages) => {
            const member = await generator.createUser({ gsuite_id: 'example-stored@aegee.eu' });

            const res = await setAccount(member, value);

            expect(res.statusCode).toEqual(422);
            expect(Object.keys(res.body).sort()).toEqual(['errors', 'success']);
            expect(Object.keys(res.body.errors)).toEqual(['gsuite_id']);
            // The rules are checked side by side, so their order differs.
            expect([...res.body.errors.gsuite_id].sort()).toEqual([...messages].sort());

            const fromDb = await User.findByPk(member.id);
            expect(fromDb.gsuite_id).toEqual('example-stored@aegee.eu');
        });

        test.each([
            ['the same', 'example-taken@aegee.eu'],
            ['in another case', 'example-Taken@AEGEE.eu'],
            ['with spaces around it', ' example-taken@aegee.eu ']
        ])('should fail if another member has it (%s), and keep both as they are', async (name, value) => {
            const owner = await generator.createUser({ gsuite_id: 'example-taken@aegee.eu' });
            const member = await generator.createUser();

            const res = await setAccount(member, value);

            expect(res.statusCode).toEqual(422);
            expect(res.body).toEqual({ success: false, errors: { gsuite_id: ['gsuite_id must be unique'] } });

            expect((await User.findByPk(member.id)).gsuite_id).toBeNull();
            expect((await User.findByPk(owner.id)).gsuite_id).toEqual('example-taken@aegee.eu');
        });

        test('should accept the account the member has already, in another case', async () => {
            const member = await generator.createUser({ gsuite_id: 'example-some.one@aegee.eu' });

            const res = await setAccount(member, 'example-Some.One@AEGEE.eu');

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.gsuite_id).toEqual('example-some.one@aegee.eu');
        });
    });

    test('should name the permission that is needed for another member, and change nothing', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const otherUser = await generator.createUser({ first_name: 'Some' });

        const res = await request({
            path: '/members/' + otherUser.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { first_name: 'Changed' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body).toEqual({ success: false, message: 'Permission update:member is required, but not present.' });

        const fromDb = await User.findByPk(otherUser.id);
        expect(fromDb.first_name).toEqual('Some');
    });
});
