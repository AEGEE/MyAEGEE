const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { Circle } = require('../../models');

describe('Circle setting parent circle', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should return 404 if the parent circle is not found', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);
        const circle = await generator.createCircle();

        await generator.createPermission({ scope: 'global', action: 'put_parent', object: 'circle' });

        const res = await request({
            uri: '/circles/' + circle.id + '/parent',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { parent_circle_id: 1337 }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 400 if the parent circle id is not valid', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);
        const circle = await generator.createCircle();

        await generator.createPermission({ scope: 'global', action: 'put_parent', object: 'circle' });

        const res = await request({
            uri: '/circles/' + circle.id + '/parent',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { parent_circle_id: 'nan' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if the circle links to itself', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);
        const circle = await generator.createCircle();

        await generator.createPermission({ scope: 'global', action: 'put_parent', object: 'circle' });

        const res = await request({
            uri: '/circles/' + circle.id + '/parent',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { parent_circle_id: circle.id }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');

        const circleFromDb = await Circle.findByPk(circle.id);
        expect(circleFromDb.parent_circle_id).not.toEqual(circleFromDb.id);
    });

    test('should fail if there are loops', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const circle1 = await generator.createCircle();
        const circle2 = await generator.createCircle({}, circle1);
        const circle3 = await generator.createCircle({}, circle2);

        await generator.createPermission({ scope: 'global', action: 'put_parent', object: 'circle' });

        const res = await request({
            uri: '/circles/' + circle1.id + '/parent',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { parent_circle_id: circle3.id }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');

        const circleFromDb = await Circle.findByPk(circle1.id);
        expect(circleFromDb.parent_circle_id).not.toEqual(circle3.id);
    });

    test('should succeed if everything is okay', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const circle = await generator.createCircle();
        const otherCircle = await generator.createCircle();

        await generator.createPermission({ scope: 'global', action: 'put_parent', object: 'circle' });

        const res = await request({
            uri: '/circles/' + circle.id + '/parent',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { parent_circle_id: otherCircle.id }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        const circleFromDb = await Circle.findByPk(circle.id);
        expect(circleFromDb.parent_circle_id).toEqual(otherCircle.id);
    });

    test('should not fail if there are not any loops', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const circle1 = await generator.createCircle();
        const circle2 = await generator.createCircle({}, circle1);
        const circle3 = await generator.createCircle({});

        await generator.createPermission({ scope: 'global', action: 'put_parent', object: 'circle' });

        const res = await request({
            uri: '/circles/' + circle3.id + '/parent',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { parent_circle_id: circle2.id }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        const circleFromDb = await Circle.findByPk(circle3.id);
        expect(circleFromDb.parent_circle_id).toEqual(circle2.id);
    });

    test('should fail if no permissions', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const circle1 = await generator.createCircle();
        const circle2 = await generator.createCircle({}, circle1);
        const circle3 = await generator.createCircle({});

        const res = await request({
            uri: '/circles/' + circle3.id + '/parent',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { parent_circle_id: circle2.id }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should allow unsetting parent circle', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const circle = await generator.createCircle();
        const otherCircle = await generator.createCircle({ parent_circle_id: circle.id });

        await generator.createPermission({ scope: 'global', action: 'put_parent', object: 'circle' });

        const res = await request({
            uri: '/circles/' + otherCircle.id + '/parent',
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { parent_circle_id: null }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        const circleFromDb = await Circle.findByPk(otherCircle.id);
        expect(circleFromDb.parent_circle_id).toEqual(null);
    });
});
