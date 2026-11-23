const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('My permissions global', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should list the global permission that is assigned to a circle user is member of', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const permission = await generator.createPermission({ scope: 'global', action: 'action', object: 'object' });
        const circle = await generator.createCircle();
        await generator.createCirclePermission(circle, permission);
        await generator.createCircleMembership(circle, user);

        const res = await request({
            path: '/my_permissions',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].combined).toEqual('global:action:object');
    });

    test('should not list the local permissions that is assigned to a circle user is member of', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const permission = await generator.createPermission({ scope: 'local', action: 'action', object: 'object' });
        const circle = await generator.createCircle();
        await generator.createCirclePermission(circle, permission);
        await generator.createCircleMembership(circle, user);

        const res = await request({
            path: '/my_permissions',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(0);
    });

    test('should list the global permission that is assigned to a circle user is indirectly a member of', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const permission = await generator.createPermission({ scope: 'global', action: 'action', object: 'object' });
        const firstCircle = await generator.createCircle();
        const secondCircle = await generator.createCircle({ parent_circle_id: firstCircle.id });
        const thirdCircle = await generator.createCircle({ parent_circle_id: secondCircle.id });

        await generator.createCirclePermission(firstCircle, permission);
        await generator.createCircleMembership(thirdCircle, user);

        const res = await request({
            path: '/my_permissions',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].combined).toEqual('global:action:object');
    });

    test('should not list the global permission that is assigned to a circle user is not a member of', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const permission = await generator.createPermission({ scope: 'global', action: 'action', object: 'object' });
        const circle = await generator.createCircle();
        await generator.createCirclePermission(circle, permission);

        const res = await request({
            path: '/my_permissions',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(0);
    });

    test('should list all permissions if a user is superadmin', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const permission = await generator.createPermission({ scope: 'global', action: 'action', object: 'object' });
        const circle = await generator.createCircle();
        await generator.createCirclePermission(circle, permission);

        const res = await request({
            path: '/my_permissions',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].combined).toEqual('global:action:object');
    });

    describe('shape of the rows', () => {
        const getPermissions = async (user, path = '/my_permissions') => {
            const token = await generator.createAccessToken(user);
            const res = await request({ path, method: 'GET', headers: { 'X-Auth-Token': token.value } });

            expect(res.statusCode).toEqual(200);
            return res.body.data;
        };

        test('should be the same for a superadmin as for any other member', async () => {
            const permission = await generator.createPermission({ scope: 'global', action: 'action', object: 'object' });
            const circle = await generator.createCircle();
            await generator.createCirclePermission(circle, permission);

            const member = await generator.createUser();
            await generator.createCircleMembership(circle, member);
            const superadmin = await generator.createUser({ superadmin: true });

            const forMember = await getPermissions(member);
            const forSuperadmin = await getPermissions(superadmin);

            expect(forMember.length).toEqual(1);
            expect(forSuperadmin.length).toEqual(1);
            expect(Object.keys(forSuperadmin[0]).sort()).toEqual(Object.keys(forMember[0]).sort());
            expect(Array.isArray(forSuperadmin[0].circle_permissions)).toEqual(true);
        });

        test('should list the circles of a superadmin that give the permission, and no others', async () => {
            const permission = await generator.createPermission({ scope: 'global', action: 'action', object: 'object' });
            const otherPermission = await generator.createPermission({ scope: 'local', action: 'other', object: 'object' });
            const ownCircle = await generator.createCircle();
            const otherCircle = await generator.createCircle();
            await generator.createCirclePermission(ownCircle, permission);
            await generator.createCirclePermission(otherCircle, permission);
            await generator.createCirclePermission(otherCircle, otherPermission);

            const superadmin = await generator.createUser({ superadmin: true });
            await generator.createCircleMembership(ownCircle, superadmin);

            const rows = await getPermissions(superadmin);

            expect(rows.map((row) => row.combined).sort()).toEqual(['global:action:object', 'local:other:object']);

            const row = rows.find((item) => item.id === permission.id);
            expect(row.circle_permissions.map((item) => item.circle_id)).toEqual([ownCircle.id]);

            const otherRow = rows.find((item) => item.id === otherPermission.id);
            expect(otherRow.circle_permissions).toEqual([]);
        });

        test('should be the same for a superadmin on the permissions for a body, a circle and a member', async () => {
            await generator.createPermission({ scope: 'local', action: 'action', object: 'object' });
            const body = await generator.createBody();
            const circle = await generator.createCircle({ body_id: body.id });
            const superadmin = await generator.createUser({ superadmin: true });
            const member = await generator.createUser();

            for (const path of [
                '/bodies/' + body.id + '/my_permissions',
                '/circles/' + circle.id + '/my_permissions',
                '/members/' + member.id + '/my_permissions'
            ]) {
                const rows = await getPermissions(superadmin, path);

                expect(rows.length).toEqual(1);
                expect(rows[0].circle_permissions).toEqual([]);
            }
        });
    });
});
