const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { Permission } = require('../../models');

describe('Permissions creating', () => {
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

        await generator.createPermission({ scope: 'global', action: 'create', object: 'permission' });

        const permission = generator.generatePermission({ scope: '' });

        const res = await request({
            path: '/permissions',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: permission
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('scope');
    });

    test('should fail if no permission', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const permission = generator.generatePermission();

        const res = await request({
            path: '/permissions',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: permission
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed if everything is okay', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'create', object: 'permission' });

        const permission = generator.generatePermission();

        const res = await request({
            path: '/permissions',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: permission
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.object).toEqual(permission.object);
    });

    test('should ignore fields that are not allowed', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'create', object: 'permission' });

        const permission = generator.generatePermission({ id: 2147483647, filters: ['name'] });

        const res = await request({
            path: '/permissions',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: permission
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.id).not.toEqual(2147483647);

        const permissionFromDb = await Permission.findByPk(res.body.data.id);
        expect(permissionFromDb.filters).toEqual(['name']);
        expect(permissionFromDb.combined).toEqual(`global:${permission.action}:${permission.object}`);
    });

    test('should refuse a filter that is longer than its column', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);
        await generator.createPermission({ scope: 'global', action: 'create', object: 'permission' });

        const res = await request({
            path: '/permissions',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: generator.generatePermission({ filters: ['name', 'a'.repeat(256)] })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.errors).toEqual({ filters: ['Each filter should be at most 255 characters long.'] });
        expect(await Permission.count()).toEqual(1);
    });

    test('should accept a filter of 255 characters', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);
        await generator.createPermission({ scope: 'global', action: 'create', object: 'permission' });

        const res = await request({
            path: '/permissions',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: generator.generatePermission({ filters: ['a'.repeat(255)] })
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.filters).toEqual(['a'.repeat(255)]);
    });

    describe('with the scope, action and object of an existing permission', () => {
        const message = 'There\'s already a permission with such scope, action and object.';
        let token;

        beforeEach(async () => {
            const user = await generator.createUser({ superadmin: true });
            token = await generator.createAccessToken(user);

            await generator.createPermission({ scope: 'global', action: 'create', object: 'permission' });
            await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });
        });

        test.each([
            ['written the same', { scope: 'global', action: 'view', object: 'member' }],
            ['written in another case and with spaces around it', { scope: 'global', action: ' VIEW', object: 'Member ' }]
        ])('should fail if it is %s', async (name, fields) => {
            const res = await request({
                path: '/permissions',
                method: 'POST',
                headers: { 'X-Auth-Token': token.value },
                body: generator.generatePermission({ ...fields })
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body).toEqual({
                success: false,
                errors: { scope: [message], action: [message], object: [message] }
            });
            expect(await Permission.count({ where: { action: 'view', object: 'member' } })).toEqual(1);
        });

        test('should succeed if only the scope differs', async () => {
            const res = await request({
                path: '/permissions',
                method: 'POST',
                headers: { 'X-Auth-Token': token.value },
                body: generator.generatePermission({ scope: 'local', action: 'view', object: 'member' })
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.combined).toEqual('local:view:member');
            expect(await Permission.count({ where: { action: 'view', object: 'member' } })).toEqual(2);
        });
    });
});
