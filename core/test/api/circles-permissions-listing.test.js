const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('Circle permissions', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should display the permission if it\'s directly attached', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const circle = await generator.createCircle();
        const permission = await generator.createPermission();
        await generator.createCirclePermission(circle, permission);

        const res = await request({
            path: '/circles/' + circle.id + '/permissions',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(permission.id);
    });

    test('should display the permission if it\'s indirectly attached', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const firstCircle = await generator.createCircle();
        const secondCircle = await generator.createCircle({ parent_circle_id: firstCircle.id });
        const thirdCircle = await generator.createCircle({ parent_circle_id: secondCircle.id });
        const permission = await generator.createPermission();
        await generator.createCirclePermission(thirdCircle, permission);

        const res = await request({
            path: '/circles/' + thirdCircle.id + '/permissions',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(permission.id);
    });

    test('should count a permission once if the circle and a parent circle both have it', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const parentCircle = await generator.createCircle();
        const circle = await generator.createCircle({ parent_circle_id: parentCircle.id });
        const permission = await generator.createPermission();
        const otherPermission = await generator.createPermission();
        await generator.createCirclePermission(circle, permission);
        await generator.createCirclePermission(parentCircle, permission);
        await generator.createCirclePermission(parentCircle, otherPermission);

        const res = await request({
            path: '/circles/' + circle.id + '/permissions',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.map((row) => row.id).sort()).toEqual([permission.id, otherPermission.id].sort());
        expect(res.body.meta.count).toEqual(2);

        const row = res.body.data.find((item) => item.id === permission.id);
        expect(row.circle_permissions.map((item) => item.circle_id).sort()).toEqual([circle.id, parentCircle.id].sort());
    });
});
