const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { Body } = require('../../models');

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
            path: '/bodies/1337',
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
            path: '/bodies/' + body.id,
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
            path: '/bodies/' + body.id,
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
            path: '/bodies/' + body.id,
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
            path: '/bodies/' + body.id,
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
            path: '/bodies/' + body.id,
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
                path: '/bodies/' + body.id,
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

    for (const type of ['interest group', 'working group', 'commission', 'committee', 'project', 'partner', 'external', 'other']) {
        test(`should succeed when foundation date is empty on ${type}`, async () => {
            const user = await generator.createUser({ superadmin: true });
            const token = await generator.createAccessToken(user);

            await generator.createPermission({ scope: 'global', action: 'update', object: 'body' });

            const body = await generator.createBody({ type });

            const res = await request({
                path: '/bodies/' + body.id,
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

    describe('website', () => {
        const updateWebsite = async (website) => {
            const user = await generator.createUser({ superadmin: true });
            const token = await generator.createAccessToken(user);

            await generator.createPermission({ scope: 'global', action: 'update', object: 'body' });

            const body = await generator.createBody({ website: 'https://www.aegee.org' });

            const res = await request({
                path: '/bodies/' + body.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { website }
            });

            return { res, bodyFromDb: await Body.findByPk(body.id) };
        };

        test.each([
            // eslint-disable-next-line no-script-url
            'javascript:alert(1)',
            'data:text/html,<script>alert(1)</script>',
            'https://exa mple.org',
            'java\tscript://%0aalert(1)',
            'www.aegee-enschede.nl'
        ])('should reject %j', async (website) => {
            const { res, bodyFromDb } = await updateWebsite(website);

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('website');
            expect(bodyFromDb.website).toEqual('https://www.aegee.org');
        });

        test('should not block other edits when an old website does not pass validation', async () => {
            const user = await generator.createUser();
            const token = await generator.createAccessToken(user);

            // A board with a permission limited to some fields, which include the website.
            const permission = await generator.createPermission({
                scope: 'local',
                action: 'update',
                object: 'body',
                filters: ['description', 'website']
            });

            const body = await generator.createBody();
            await body.update({ website: 'javascript:alert(1)' }, { validate: false }); // eslint-disable-line no-script-url
            const circle = await generator.createCircle({ body_id: body.id });
            await generator.createBodyMembership(body, user);
            await generator.createCircleMembership(circle, user);
            await generator.createCirclePermission(circle, permission);

            const res = await request({
                path: '/bodies/' + body.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                // The frontend sends the whole body, including the unchanged website.
                body: { ...body.toJSON(), description: 'New description', name: 'Not allowed' }
            });

            expect(res.statusCode).toEqual(200);

            const bodyFromDb = await Body.findByPk(body.id);
            expect(bodyFromDb.description).toEqual('New description');
            expect(bodyFromDb.name).toEqual(body.name);
        });

        test.each([
            'https://www.aegee-enschede.nl',
            '',
            null
        ])('should accept %j', async (website) => {
            const { res, bodyFromDb } = await updateWebsite(website);

            expect(res.statusCode).toEqual(200);
            expect(bodyFromDb.website).toEqual(website);
        });
    });

    test('should ignore fields that are not allowed on global permission without filters', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'body' });

        const body = await generator.createBody();

        const res = await request({
            path: '/bodies/' + body.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { email: 'test@test.io', status: 'deleted' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);

        const bodyFromDb = await Body.findByPk(body.id);
        expect(bodyFromDb.email).toEqual('test@test.io');
        expect(bodyFromDb.status).toEqual('active');
    });

    test('should allow setting the shadow circle', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'body' });

        const body = await generator.createBody();
        const circle = await generator.createCircle({ body_id: body.id });

        const res = await request({
            path: '/bodies/' + body.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { shadow_circle_id: circle.id }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);

        const bodyFromDb = await Body.findByPk(body.id);
        expect(bodyFromDb.shadow_circle_id).toEqual(circle.id);
    });

    test('should allow unsetting the shadow circle', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'body' });

        const body = await generator.createBody();
        const circle = await generator.createCircle({ body_id: body.id });
        await body.update({ shadow_circle_id: circle.id });

        const res = await request({
            path: '/bodies/' + body.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { shadow_circle_id: null }
        });

        expect(res.statusCode).toEqual(200);

        const bodyFromDb = await Body.findByPk(body.id);
        expect(bodyFromDb.shadow_circle_id).toEqual(null);
    });

    test('should keep the shadow circle when other fields are edited', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'update', object: 'body' });

        const body = await generator.createBody();
        const circle = await generator.createCircle({ body_id: body.id });
        await body.update({ shadow_circle_id: circle.id });

        const res = await request({
            path: '/bodies/' + body.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': token.value },
            body: { email: 'test@test.io', shadow_circle_id: circle.id }
        });

        expect(res.statusCode).toEqual(200);

        const bodyFromDb = await Body.findByPk(body.id);
        expect(bodyFromDb.email).toEqual('test@test.io');
        expect(bodyFromDb.shadow_circle_id).toEqual(circle.id);
    });

    describe('shadow circle of the body itself', () => {
        const setShadowCircle = async (shadowCircleId) => {
            const user = await generator.createUser({ superadmin: true });
            const token = await generator.createAccessToken(user);

            await generator.createPermission({ scope: 'global', action: 'update', object: 'body' });

            const body = await generator.createBody();
            const ownCircle = await generator.createCircle({ body_id: body.id });
            await body.update({ shadow_circle_id: ownCircle.id });

            const res = await request({
                path: '/bodies/' + body.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { email: 'test@test.io', shadow_circle_id: await shadowCircleId() }
            });

            const bodyFromDb = await Body.findByPk(body.id);
            return { res, bodyFromDb, ownCircle };
        };

        const expectRefused = ({ res, bodyFromDb, ownCircle }) => {
            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(res.body).not.toHaveProperty('data');
            expect(res.body.errors).toEqual({
                shadow_circle_id: ['The shadow circle should be a circle of this body.']
            });

            // Nothing of the request is saved.
            expect(bodyFromDb.shadow_circle_id).toEqual(ownCircle.id);
            expect(bodyFromDb.email).not.toEqual('test@test.io');
        };

        test('should refuse a circle of another body', async () => {
            expectRefused(await setShadowCircle(async () => {
                const otherBody = await generator.createBody();
                const circle = await generator.createCircle({ body_id: otherBody.id });
                return circle.id;
            }));
        });

        test('should refuse a circle that belongs to no body', async () => {
            expectRefused(await setShadowCircle(async () => {
                const circle = await generator.createCircle();
                return circle.id;
            }));
        });

        test('should refuse a circle that does not exist', async () => {
            expectRefused(await setShadowCircle(async () => 2147483647));
        });

        test.each([
            ['a string', 'abc'],
            ['a list', [1]],
            ['an object', { id: 1 }],
            ['a boolean', true],
            ['a fraction', 1.5]
        ])('should refuse %s', async (name, value) => {
            expectRefused(await setShadowCircle(async () => value));
        });

        test('should accept the id of a circle of the body as a string', async () => {
            const user = await generator.createUser({ superadmin: true });
            const token = await generator.createAccessToken(user);

            await generator.createPermission({ scope: 'global', action: 'update', object: 'body' });

            const body = await generator.createBody();
            const circle = await generator.createCircle({ body_id: body.id });

            const res = await request({
                path: '/bodies/' + body.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { shadow_circle_id: String(circle.id) }
            });

            expect(res.statusCode).toEqual(200);

            const bodyFromDb = await Body.findByPk(body.id);
            expect(bodyFromDb.shadow_circle_id).toEqual(circle.id);
        });

        test('should not block other edits when the stored shadow circle is sent back unchanged', async () => {
            const user = await generator.createUser({ superadmin: true });
            const token = await generator.createAccessToken(user);

            await generator.createPermission({ scope: 'global', action: 'update', object: 'body' });

            // Stored before the rule existed: clients send the whole body back on every edit.
            const freeCircle = await generator.createCircle();
            const body = await generator.createBody({ shadow_circle_id: freeCircle.id });

            const res = await request({
                path: '/bodies/' + body.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { email: 'test@test.io', shadow_circle_id: freeCircle.id }
            });

            expect(res.statusCode).toEqual(200);

            const bodyFromDb = await Body.findByPk(body.id);
            expect(bodyFromDb.email).toEqual('test@test.io');
            expect(bodyFromDb.shadow_circle_id).toEqual(freeCircle.id);
        });

        test('should ignore the field for a permission that does not cover it', async () => {
            const user = await generator.createUser();
            const token = await generator.createAccessToken(user);

            const body = await generator.createBody();
            const permission = await generator.createPermission({
                scope: 'local',
                action: 'update',
                object: 'body',
                filters: ['name']
            });
            const boardCircle = await generator.createCircle({ body_id: body.id });
            await generator.createCircleMembership(boardCircle, user);
            await generator.createCirclePermission(boardCircle, permission);

            const freeCircle = await generator.createCircle();

            const res = await request({
                path: '/bodies/' + body.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': token.value },
                body: { name: 'Renamed', shadow_circle_id: freeCircle.id }
            });

            expect(res.statusCode).toEqual(200);

            const bodyFromDb = await Body.findByPk(body.id);
            expect(bodyFromDb.name).toEqual('Renamed');
            expect(bodyFromDb.shadow_circle_id).toEqual(null);
        });
    });
});
