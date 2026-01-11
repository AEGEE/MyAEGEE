const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('Circle editing', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should return 404 if the circle is not found', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'circle' });

        const res = await request({
            uri: '/circles/1337',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { name: 'New name' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if there are validation errors', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const circle = await generator.createCircle();

        await generator.createPermission({ scope: 'global', action: 'update', object: 'circle' });

        const res = await request({
            uri: '/circles/' + circle.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { name: '' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('name');
    });

    test('should succeed if everything is okay', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const circle = await generator.createCircle();

        await generator.createPermission({ scope: 'global', action: 'update', object: 'circle' });

        const res = await request({
            uri: '/circles/' + circle.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { name: 'New name' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.name).toEqual('New name');
    });

    test('should work with local permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        const circle = await generator.createCircle({ body_id: body.id });

        const permission = await generator.createPermission({ scope: 'local', action: 'update', object: 'circle' });
        const bodyCircle = await generator.createCircle({ body_id: body.id });
        await generator.createBodyMembership(body, user);
        await generator.createCircleMembership(bodyCircle, user);
        await generator.createCirclePermission(bodyCircle, permission);

        const res = await request({
            uri: '/circles/' + circle.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { name: 'New name' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.name).toEqual('New name');
    });

    test('should fail if no permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const circle = await generator.createCircle();

        const res = await request({
            uri: '/circles/' + circle.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { name: 'New name' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });
});
