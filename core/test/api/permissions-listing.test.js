const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('Permission list', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should succeed when everything is okay', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const permissions = await generator.createPermission();

        const res = await request({
            uri: '/permissions',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(permissions.id);
    });

    test('should respect limit and offset', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        await generator.createPermission();
        const circle = await generator.createPermission();
        await generator.createPermission();

        const res = await request({
            uri: '/permissions?limit=1&offset=1', // second one should be returned
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(circle.id);

        expect(res.body.meta.count).toEqual(3);
    });

    test('should respect sorting', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const firstPermission = await generator.createPermission({ action: 'aaa' });
        const secondPermission = await generator.createPermission({ action: 'bbb' });

        const res = await request({
            uri: '/permissions?sort=action&direction=desc', // second one should be returned
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(2);
        expect(res.body.data[0].id).toEqual(secondPermission.id);
        expect(res.body.data[1].id).toEqual(firstPermission.id);
    });

    test('should find by combined', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const permission = await generator.createPermission({ scope: 'global', action: 'action', object: 'object' });
        await generator.createPermission({ scope: 'global', action: 'action2', object: 'object2' });

        const res = await request({
            uri: '/permissions?query=global:action:object',
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

    test('should find by description', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const permission = await generator.createPermission({ description: 'test' });
        await generator.createPermission({ description: 'zzz' });

        const res = await request({
            uri: '/permissions?query=test',
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
