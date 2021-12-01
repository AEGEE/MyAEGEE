const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('Bodies creating', () => {
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
        const user = await generator.createUser({ username: 'test', mail_confirmed_at: new Date(), superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'create', object: 'body' });

        const body = generator.generateBody({ code: null });

        const res = await request({
            uri: '/bodies/',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('code');
    });

    test('should fail if no permissions', async () => {
        const user = await generator.createUser({ username: 'test', mail_confirmed_at: new Date() });
        const token = await generator.createAccessToken(user);

        const body = generator.generateBody();

        const res = await request({
            uri: '/bodies/',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed if everything is okay', async () => {
        const user = await generator.createUser({ username: 'test', mail_confirmed_at: new Date(), superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'create', object: 'body' });

        const body = generator.generateBody();

        const res = await request({
            uri: '/bodies/',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.name).toEqual(body.name);
    });

    for (const type of ['antenna', 'contact antenna', 'contact']) {
        test(`should fail when foundation date is empty on ${type}`, async () => {
            const user = await generator.createUser({ username: 'test', mail_confirmed_at: new Date(), superadmin: true });
            const token = await generator.createAccessToken(user);

            await generator.createPermission({ scope: 'global', action: 'create', object: 'body' });

            const body = generator.generateBody({ type, founded_at: null });

            const res = await request({
                uri: '/bodies/',
                method: 'POST',
                headers: { 'X-Auth-Token': token.value },
                body
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(res.body).not.toHaveProperty('data');
            expect(res.body).toHaveProperty('errors');
            expect(res.body.errors).toHaveProperty('founded_at');
        });
    }

    for (const type of ['interest group', 'working group', 'commission', 'committee', 'project', 'partner', 'other']) {
        test(`should succeed when foundation date is empty on ${type}`, async () => {
            const user = await generator.createUser({ username: 'test', mail_confirmed_at: new Date(), superadmin: true });
            const token = await generator.createAccessToken(user);

            await generator.createPermission({ scope: 'global', action: 'create', object: 'body' });

            const body = generator.generateBody({ type, founded_at: null });

            const res = await request({
                uri: '/bodies/',
                method: 'POST',
                headers: { 'X-Auth-Token': token.value },
                body
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).not.toHaveProperty('errors');
            expect(res.body).toHaveProperty('data');
        });
    }
});
