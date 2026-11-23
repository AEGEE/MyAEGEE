const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('Bodies list', () => {
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

        const body = await generator.createBody();

        const res = await request({
            path: '/bodies',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(body.id);

        expect(res.body.meta.count).toEqual(1);
    });

    test('should respect limit and offset', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        // Adding name to make sure sorting is correct
        await generator.createBody({ name: 'AAA' });
        const body = await generator.createBody({ name: 'BBB' });
        await generator.createBody({ name: 'CCC' });

        const res = await request({
            path: '/bodies?limit=1&offset=1', // second one should be returned
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(body.id);

        expect(res.body.meta.count).toEqual(3);
    });

    test('should respect sorting', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const firstBody = await generator.createBody({ code: 'AAA' });
        const secondBody = await generator.createBody({ code: 'BBB' });

        const res = await request({
            path: '/bodies?sort=code&direction=desc', // second one should be returned
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(2);
        expect(res.body.data[0].id).toEqual(secondBody.id);
        expect(res.body.data[1].id).toEqual(firstBody.id);
    });

    test('should find body by name case-sensitive', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const firstBody = await generator.createBody({ name: 'AAA' });
        await generator.createBody({ name: 'BBB' });

        const res = await request({
            path: '/bodies?query=AAA', // first one should be returned
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(firstBody.id);
    });

    test('should find body by name case-insensitive', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const firstBody = await generator.createBody({ name: 'AAA' });
        await generator.createBody({ name: 'BBB' });

        const res = await request({
            path: '/bodies?query=aaa', // first one should be returned
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(firstBody.id);
    });

    test('should find body by code case-sensitive', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const firstBody = await generator.createBody({ name: 'ZZZ', code: 'AAA' });
        await generator.createBody({ name: 'ZZZ', code: 'BBB' });

        const res = await request({
            path: '/bodies?query=AAA', // first one should be returned
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(firstBody.id);
    });

    test('should find body by code case-sensitive', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const firstBody = await generator.createBody({ name: 'ZZZ', code: 'AAA' });
        await generator.createBody({ name: 'ZZZ', code: 'BBB' });

        const res = await request({
            path: '/bodies?query=aaa', // first one should be returned
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(firstBody.id);
    });

    test('should find by part of the name/code', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const firstBody = await generator.createBody({ name: 'aaa', code: 'aaa' });
        await generator.createBody({ name: 'bbb', code: 'bbb' });

        const res = await request({
            path: '/bodies?query=a', // first one should be returned
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(firstBody.id);
    });

    test('should filter deleted bodies on /bodies', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        await generator.createBody({ status: 'deleted' });

        const res = await request({
            path: '/bodies',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.length).toEqual(0);
    });

    test('should return 401 if not authorized on /bodies?all=true', async () => {
        const res = await request({
            path: '/bodies?all=true',
            method: 'GET'
        });

        expect(res.statusCode).toEqual(401);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 403 if no permission on /bodies?all=true', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/bodies?all=true',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should treat /bodies?all=false like no all parameter', async () => {
        await generator.createBody({ status: 'deleted' });
        const activeBody = await generator.createBody();

        const res = await request({
            path: '/bodies?all=false',
            method: 'GET'
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.map((body) => body.id)).toEqual([activeBody.id]);
    });

    test('should not filter deleted bodies on /bodies?all=true', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'view_deleted', object: 'body' });

        await generator.createBody({ status: 'deleted' });

        const res = await request({
            path: '/bodies?all=true',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.data.length).toEqual(1);
    });

    test('should filter by one type for a member', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        await generator.createBody({ type: 'antenna' });
        await generator.createBody({ type: 'contact' });

        const res = await request({
            path: '/bodies?type=contact',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.map((body) => body.type)).toEqual(['contact']);
    });

    test('should filter by several types for a member', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        await generator.createBody({ type: 'antenna' });
        await generator.createBody({ type: 'partner' });
        await generator.createBody({ type: 'working group' });

        const res = await request({
            path: '/bodies?type=antenna,partner',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.map((body) => body.type).sort()).toEqual(['antenna', 'partner']);
    });

    test('should answer with an empty list for a type that does not exist', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        await generator.createBody({ type: 'antenna' });

        const res = await request({
            path: '/bodies?type=club',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data).toEqual([]);
    });

    test.each([
        ['a boolean', '/bodies?type=true'],
        ['a list', '/bodies?type[]=antenna&type[]=contact'],
        ['an object', '/bodies?type[a]=antenna'],
        ['only spaces', '/bodies?type=%20']
    ])('should answer 400 if the type is %s', async (name, path) => {
        await generator.createBody({ type: 'antenna' });

        const res = await request({ path, method: 'GET' });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body.message).toEqual('The "type" filter should be a text.');
        expect(res.body).not.toHaveProperty('data');
    });

    describe('the types of bodies that are listed', () => {
        const TYPES = [
            'antenna', 'contact antenna', 'contact', 'interest group', 'working group', 'commission',
            'committee', 'project', 'partner', 'external', 'other'
        ];
        const TYPES_WITHOUT_LOGIN = ['antenna', 'contact', 'contact antenna'];

        const listedTypes = (res) => res.body.data.map((body) => body.type).sort();

        // One body of every type.
        beforeEach(async () => {
            for (const type of TYPES) {
                await generator.createBody({ type, name: 'Body ' + type });
            }
        });

        test('should be only antennae, contact antennae and contacts without a login', async () => {
            const res = await request({ path: '/bodies', method: 'GET' });

            expect(res.statusCode).toEqual(200);
            expect(listedTypes(res)).toEqual(TYPES_WITHOUT_LOGIN);
            expect(res.body.meta).toEqual({ count: 3 });
        });

        test('should be all types for a member', async () => {
            const user = await generator.createUser();
            const token = await generator.createAccessToken(user);

            const res = await request({
                path: '/bodies',
                method: 'GET',
                headers: { 'X-Auth-Token': token.value }
            });

            expect(res.statusCode).toEqual(200);
            expect(listedTypes(res)).toEqual([...TYPES].sort());
            expect(res.body.meta).toEqual({ count: TYPES.length });
        });

        test('should not find a body of another type by its name without a login', async () => {
            const res = await request({ path: '/bodies?query=Body%20partner', method: 'GET' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toEqual([]);
            expect(res.body.meta).toEqual({ count: 0 });
        });

        test('should not list another type that is asked for without a login', async () => {
            const res = await request({ path: '/bodies?type=partner,working%20group', method: 'GET' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.filter((body) => !TYPES_WITHOUT_LOGIN.includes(body.type))).toEqual([]);
        });
    });
});
