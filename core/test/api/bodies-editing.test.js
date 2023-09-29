const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('Bodies editing', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should return 404 if the body is not found', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'body' });

        const res = await request({
            uri: '/bodies/1337',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { email: 'test@test.io' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if there are validation errors', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'body' });

        const body = await generator.createBody();

        const res = await request({
            uri: '/bodies/' + body.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { code: null }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('code');
    });

    test('should fail if no permissions', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();

        const res = await request({
            uri: '/bodies/' + body.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { email: 'invalid' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed on global permission', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'body' });

        const body = await generator.createBody();

        const res = await request({
            uri: '/bodies/' + body.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { email: 'test@test.io' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.email).toEqual('test@test.io');
    });

    test('should succeed on local permission', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const permission = await generator.createPermission({
            scope: 'local',
            action: 'update',
            object: 'body'
        });

        const body = await generator.createBody();
        const circle = await generator.createCircle({ body_id: body.id });
        await generator.createBodyMembership(body, user);
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);

        const res = await request({
            uri: '/bodies/' + body.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { email: 'test@test.io' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.email).toEqual('test@test.io');
    });

    test('should respect filters', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const permission = await generator.createPermission({
            scope: 'local',
            action: 'update',
            object: 'body',
            filters: ['name']
        });

        const body = await generator.createBody({ name: 'aaa' });
        const circle = await generator.createCircle({ body_id: body.id });
        await generator.createBodyMembership(body, user);
        await generator.createCircleMembership(circle, user);
        await generator.createCirclePermission(circle, permission);

        const res = await request({
            uri: '/bodies/' + body.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { email: 'test@test.io', name: 'bbb' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.email).not.toEqual('test@test.io');
        expect(res.body.data.name).toEqual('bbb');
    });

    for (const type of ['antenna', 'contact antenna', 'contact']) {
        test(`should fail when foundation date is empty on ${type}`, async () => {
            const user = await generator.createUser({ superadmin: true });
            const token = await generator.createAccessToken(user);

            await generator.createPermission({ scope: 'global', action: 'update', object: 'body' });

            const body = await generator.createBody({ type });

            const res = await request({
                uri: '/bodies/' + body.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { founded_at: null }
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(res.body).not.toHaveProperty('data');
            expect(res.body).toHaveProperty('errors');
            expect(res.body.errors).toHaveProperty('founded_at');
        });
    }

    for (const type of ['interest group', 'working group', 'commission', 'committee', 'project', 'partner', 'other']) {
        test(`should succeed when foundation date is empty on ${type}`, async () => {
            const user = await generator.createUser({ superadmin: true });
            const token = await generator.createAccessToken(user);

            await generator.createPermission({ scope: 'global', action: 'update', object: 'body' });

            const body = await generator.createBody({ type });

            const res = await request({
                uri: '/bodies/' + body.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { founded_at: null }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).not.toHaveProperty('errors');
            expect(res.body).toHaveProperty('data');
        });
    }
});
