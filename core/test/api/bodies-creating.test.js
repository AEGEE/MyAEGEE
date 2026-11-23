const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { Body } = require('../../models');

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
            path: '/bodies/',
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
            path: '/bodies/',
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
            path: '/bodies/',
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
                path: '/bodies/',
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

    for (const type of ['interest group', 'working group', 'commission', 'committee', 'project', 'partner', 'external', 'other']) {
        test(`should succeed when foundation date is empty on ${type}`, async () => {
            const user = await generator.createUser({ username: 'test', mail_confirmed_at: new Date(), superadmin: true });
            const token = await generator.createAccessToken(user);

            await generator.createPermission({ scope: 'global', action: 'create', object: 'body' });

            const body = generator.generateBody({ type, founded_at: null });

            const res = await request({
                path: '/bodies/',
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

    test('should ignore fields that are not allowed', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'create', object: 'body' });

        const body = generator.generateBody({ status: 'deleted' });

        const res = await request({
            path: '/bodies/',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);

        const bodyFromDb = await Body.findByPk(res.body.data.id);
        expect(bodyFromDb.name).toEqual(body.name);
        expect(bodyFromDb.status).toEqual('active');
    });

    describe('with a value that is taken or is not one', () => {
        let token;

        beforeEach(async () => {
            const user = await generator.createUser({ superadmin: true });
            token = await generator.createAccessToken(user);

            await generator.createPermission({ scope: 'global', action: 'create', object: 'body' });
            await generator.createBody({
                code: 'ABC',
                abbreviation: 'AEGEE-Somewhere',
                gsuite_id: 'somewhere@aegee.eu',
                google_group: 'somewhere-l@aegee.eu'
            });
        });

        const typeMessage = 'Type must be one of these: "antenna", "contact antenna", "contact", "interest group", '
            + '"working group", "commission", "committee", "project", "partner", "external", "other".';

        test.each([
            ['a code that another body has', { code: 'ABC' }, { code: ['code must be unique'] }],
            ['a code that another body has in another case', { code: 'abc' }, { code: ['code must be unique'] }],
            ['a type that does not exist', { type: 'club' }, { type: [typeMessage] }],
            ['an abbreviation that another body has', { abbreviation: 'AEGEE-Somewhere' }, { abbreviation: ['abbreviation must be unique'] }],
            ['an abbreviation that another body has, with spaces around it', { abbreviation: ' AEGEE-Somewhere ' }, { abbreviation: ['abbreviation must be unique'] }],
            ['a Workspace account that is not an email address', { gsuite_id: 'x' }, { gsuite_id: ['GSuite ID must be a valid email.'] }],
            ['a Workspace account that another body has', { gsuite_id: 'Somewhere@AEGEE.eu' }, { gsuite_id: ['gsuite_id must be unique'] }],
            ['a Google group that is not an email address', { google_group: 'x' }, { google_group: ['Google Group must be a valid email.'] }],
            ['a Google group that another body has', { google_group: 'Somewhere-L@aegee.eu' }, { google_group: ['google_group must be unique'] }]
        ])('should fail for %s', async (name, fields, errors) => {
            const res = await request({
                path: '/bodies/',
                method: 'POST',
                headers: { 'X-Auth-Token': token.value },
                // A code of its own, so only the field of the row can be refused.
                body: generator.generateBody({ code: 'XYZ', ...fields })
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body).toEqual({ success: false, errors });
            expect(await Body.count()).toEqual(1);
        });
    });
});
