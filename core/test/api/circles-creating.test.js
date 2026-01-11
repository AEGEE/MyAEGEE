const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('Circles creating', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should fail if there are validation errors', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'create', object: 'circle' });

        const circle = generator.generateCircle({ name: '' });

        const res = await request({
            uri: '/circles/',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: circle
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

        await generator.createPermission({ scope: 'global', action: 'create', object: 'circle' });

        const circle = generator.generateCircle();

        const res = await request({
            uri: '/circles/',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: circle
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.name).toEqual(circle.name);
    });

    test('should fail with local permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        const bodyCircle = await generator.createCircle({ body_id: body.id });
        const permission = await generator.createPermission({ scope: 'local', action: 'create', object: 'circle' });
        await generator.createCirclePermission(bodyCircle, permission);
        await generator.createCircleMembership(bodyCircle, user);

        const circle = generator.generateCircle();

        const res = await request({
            uri: '/circles/',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: circle
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if no permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const circle = generator.generateCircle();

        const res = await request({
            uri: '/circles/',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: circle
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should remove body_id', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'create', object: 'circle' });

        const body = await generator.createBody();
        const circle = generator.generateCircle({ body_id: body.id });

        const res = await request({
            uri: '/circles/',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: circle
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.body_id).not.toEqual(body.id);
    });
});
