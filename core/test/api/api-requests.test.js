const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const mock = require('../scripts/mock');
const logger = require('../../lib/logger');
const { Body } = require('../../models');

describe('API requests', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        jest.restoreAllMocks();
        mock.cleanAll();
        await generator.clearAll();
    });

    test('should fail if endpoint is not found', async () => {
        const res = await request({
            path: '/not-existant',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' },
            skipOpenApi: 'the not-found handler'
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should name the method and the path of an unknown endpoint, without the query', async () => {
        const res = await request({
            path: '/not-existant/1',
            query: { token: 'abc' },
            skipOpenApi: 'the not-found handler'
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body).toEqual({ success: false, message: 'No such API endpoint: GET /not-existant/1' });
    });

    test('should fail if the request is not JSON', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/bodies',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: 'garbage'
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    describe('a request body that cannot be read', () => {
        const UNREADABLE = { success: false, message: 'The request body could not be read.' };
        const login = (options) => request({ path: '/login', method: 'POST', ...options });

        test('should answer 413 for a body that is too large', async () => {
            const res = await login({ rawBody: JSON.stringify({ username: 'x'.repeat(200 * 1024), password: 'x' }) });

            expect(res.statusCode).toEqual(413);
            expect(res.body).toEqual(UNREADABLE);
        });

        test('should answer 415 for a charset the server does not read', async () => {
            const res = await login({
                headers: { 'Content-Type': 'application/json; charset=latin1' },
                rawBody: JSON.stringify({ username: 'x', password: 'x' })
            });

            expect(res.statusCode).toEqual(415);
            expect(res.body).toEqual(UNREADABLE);
        });

        test('should answer 415 for a content encoding the server does not read', async () => {
            const res = await login({
                headers: { 'Content-Encoding': 'compress' },
                rawBody: JSON.stringify({ username: 'x', password: 'x' })
            });

            expect(res.statusCode).toEqual(415);
            expect(res.body).toEqual(UNREADABLE);
        });

        test('should answer 400 for a compressed body that does not decompress', async () => {
            const res = await login({
                headers: { 'Content-Encoding': 'gzip' },
                rawBody: 'this is not gzip'
            });

            expect(res.statusCode).toEqual(400);
            expect(res.body).toEqual(UNREADABLE);
        });

        test('should answer 400 for a body that is not JSON, as before', async () => {
            const res = await login({ rawBody: '{"username": ' });

            expect(res.statusCode).toEqual(400);
            expect(res.body).toEqual({ success: false, message: 'Invalid JSON.' });
        });
    });

    describe('a request body with the character U+0000', () => {
        const REFUSED = { success: false, message: 'Texts in the request body cannot contain the character U+0000.' };

        test('should be refused in a text field, and nothing stored', async () => {
            const user = await generator.createUser({ superadmin: true });
            const token = await generator.createAccessToken(user);
            await generator.createPermission({ scope: 'global', action: 'create', object: 'body' });

            const res = await request({
                path: '/bodies',
                method: 'POST',
                headers: { 'X-Auth-Token': token.value },
                body: generator.generateBody({ name: 'a\u0000b' })
            });

            expect(res.statusCode).toEqual(400);
            expect(res.body).toEqual(REFUSED);
            expect(await Body.count()).toEqual(0);
        });

        test('should be refused in a list and in a nested object', async () => {
            const user = await generator.createUser({ superadmin: true });
            const token = await generator.createAccessToken(user);
            await generator.createPermission({ scope: 'global', action: 'create', object: 'permission' });

            for (const body of [
                { scope: 'global', action: 'a', object: 'b', description: 'c', filters: ['\u0000'] },
                { scope: 'global', action: 'a', object: 'b', description: 'c', nested: { deeper: ['x', 'y\u0000'] } },
                { scope: 'global', action: 'a', object: 'b', description: 'c', 'key\u0000': 'value' }
            ]) {
                const res = await request({
                    path: '/permissions',
                    method: 'POST',
                    headers: { 'X-Auth-Token': token.value },
                    body
                });

                expect(res.statusCode).toEqual(400);
                expect(res.body).toEqual(REFUSED);
            }
        });

        // A body nested this deep is still far below the size limit of the JSON parser.
        const nestedBody = (depth, innermost) => JSON.stringify({ username: 'x', password: 'x' }).slice(0, -1)
            + ',"nested":' + '{"a":'.repeat(depth) + JSON.stringify(innermost) + '}'.repeat(depth)
            + ',"list":' + '['.repeat(depth) + JSON.stringify(innermost) + ']'.repeat(depth) + '}';

        test('should not be looked for in vain in a body nested 10,000 levels deep', async () => {
            await generator.createUser({ username: 'deep-member', password: 'deep-password' });

            const res = await request({
                path: '/login',
                method: 'POST',
                rawBody: nestedBody(10000, 'text').replace('"username":"x","password":"x"', '"username":"deep-member","password":"deep-password"'),
                skipRequestCheck: 'the fields that are nested this deep are not ones a client sends'
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
        });

        test('should be refused at the bottom of a body nested 10,000 levels deep', async () => {
            const res = await request({
                path: '/login',
                method: 'POST',
                rawBody: nestedBody(10000, 'te\u0000xt')
            });

            expect(res.statusCode).toEqual(400);
            expect(res.body).toEqual(REFUSED);
        });

        test('should be refused on a route without a login', async () => {
            const res = await request({
                path: '/login',
                method: 'POST',
                body: { username: 'x\u0000', password: 'x' }
            });

            expect(res.statusCode).toEqual(400);
            expect(res.body).toEqual(REFUSED);
        });
    });

    describe('an error that the server did not expect', () => {
        const SERVER_ERROR = { success: false, message: 'Something went wrong on the server.' };

        test('should answer 500 without the text of the error, and log it', async () => {
            const error = new Error('relation "bodies" does not exist');
            jest.spyOn(Body, 'findAndCountAll').mockRejectedValue(error);
            const log = jest.spyOn(logger, 'error').mockImplementation(() => {});

            const res = await request({ path: '/bodies', method: 'GET' });

            expect(res.statusCode).toEqual(500);
            expect(res.body).toEqual(SERVER_ERROR);
            expect(log).toHaveBeenCalledWith({ err: error }, 'Request error');
        });

        test('should not pass on what the mailer answered', async () => {
            mock.mockAll({ mailer: { netError: true } });
            const campaign = await generator.createCampaign({ active: true });

            const res = await request({
                path: '/signup/' + campaign.url,
                method: 'POST',
                body: generator.generateUser()
            });

            expect(res.statusCode).toEqual(503);
            expect(res.body).toEqual({ success: false, message: 'The mail could not be sent, so nothing was saved. Please try again later.' });
        });

        test('should not pass on what the mailing list server answered', async () => {
            mock.mockAll();
            const log = jest.spyOn(logger, 'error').mockImplementation(() => {});
            const user = await generator.createUser();
            const token = await generator.createAccessToken(user);

            // Nothing answers at the address of the mailing list server.
            const res = await request({
                path: '/members/me/listserv',
                method: 'POST',
                headers: { 'X-Auth-Token': token.value },
                body: { mailinglists: ['ANNOUNCE-L'] }
            });

            expect(res.statusCode).toEqual(500);
            expect(res.body).toEqual(SERVER_ERROR);
            expect(log).toHaveBeenCalledWith({ err: expect.anything() }, 'Could not subscribe to the mailing lists');
        });
    });
});
