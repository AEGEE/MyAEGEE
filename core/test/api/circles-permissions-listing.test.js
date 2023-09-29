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
            uri: '/circles/' + circle.id + '/permissions',
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
            uri: '/circles/' + thirdCircle.id + '/permissions',
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
});
