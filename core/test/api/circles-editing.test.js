const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { Circle } = require('../../models');

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
            path: '/circles/2147483647',
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
            path: '/circles/' + circle.id,
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
            path: '/circles/' + circle.id,
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
            path: '/circles/' + circle.id,
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
            path: '/circles/' + circle.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { name: 'New name' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should ignore fields that are not allowed', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        const parentCircle = await generator.createCircle();
        const circle = await generator.createCircle();

        await generator.createPermission({ scope: 'global', action: 'update', object: 'circle' });

        const res = await request({
            path: '/circles/' + circle.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: {
                name: 'New name',
                gsuite_id: 'circle@aegee.eu',
                body_id: body.id,
                parent_circle_id: parentCircle.id
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);

        const circleFromDb = await Circle.findByPk(circle.id);
        expect(circleFromDb.name).toEqual('New name');
        expect(circleFromDb.gsuite_id).toEqual('circle@aegee.eu');
        expect(circleFromDb.body_id).toBeNull();
        expect(circleFromDb.parent_circle_id).toBeNull();
    });

    describe('Workspace group of the circle', () => {
        let token;
        let circle;

        beforeEach(async () => {
            const user = await generator.createUser({ superadmin: true });
            token = await generator.createAccessToken(user);
            await generator.createPermission({ scope: 'global', action: 'update', object: 'circle' });

            await generator.createCircle({ gsuite_id: 'board@aegee.eu' });
            circle = await generator.createCircle({ gsuite_id: 'members@aegee.eu' });
        });

        const update = (fields) => request({
            path: '/circles/' + circle.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: fields
        });

        test.each([
            ['is not an email address', 'x', 'GSuite ID should be a valid email.'],
            ['is the one of another circle', 'board@aegee.eu', 'gsuite_id must be unique'],
            ['is the one of another circle in another case', ' Board@AEGEE.eu ', 'gsuite_id must be unique']
        ])('should not be changed to one that %s', async (name, value, message) => {
            const res = await update({ gsuite_id: value, name: 'Other name' });

            expect(res.statusCode).toEqual(422);
            expect(res.body).toEqual({ success: false, errors: { gsuite_id: [message] } });

            const circleFromDb = await Circle.findByPk(circle.id);
            expect(circleFromDb.gsuite_id).toEqual('members@aegee.eu');
            expect(circleFromDb.name).toEqual(circle.name);
        });

        test('should be stored in lowercase and without spaces around it', async () => {
            const res = await update({ gsuite_id: ' Committee@AEGEE.eu ' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.gsuite_id).toEqual('committee@aegee.eu');
            expect((await Circle.findByPk(circle.id)).gsuite_id).toEqual('committee@aegee.eu');
        });

        test('should stay when it is sent back unchanged with other fields', async () => {
            const res = await update({ gsuite_id: 'members@aegee.eu', name: 'Other name' });

            expect(res.statusCode).toEqual(200);

            const circleFromDb = await Circle.findByPk(circle.id);
            expect(circleFromDb.gsuite_id).toEqual('members@aegee.eu');
            expect(circleFromDb.name).toEqual('Other name');
        });

        test('should be removed with null', async () => {
            const res = await update({ gsuite_id: null });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.gsuite_id).toEqual(null);
            expect((await Circle.findByPk(circle.id)).gsuite_id).toEqual(null);
        });
    });
});
