const { default: nock } = require('nock');

const config = require('../../config');
const core = require('../../lib/core');

const CORE = `${config.core.url}:${config.core.port}`;
const req = { headers: { 'x-auth-token': 'token' } };

// What the client of core makes of answers that are not what it asks for.
describe('Core client', () => {
    afterEach(() => {
        nock.cleanAll();
    });

    describe('fetching a member as the service', () => {
        const login = (status, body) => nock(CORE).post('/login').reply(status, body);
        const member = (status, body) => nock(CORE).get('/members/1337').reply(status, body);

        test('should return the member', async () => {
            login(200, { success: true, access_token: 'service-token' });
            nock(CORE, { reqheaders: { 'x-auth-token': 'service-token' } })
                .get('/members/1337')
                .reply(200, { success: true, data: { id: 1337 } });

            await expect(core.fetchApplicationUser(1337)).resolves.toEqual({ id: 1337 });
        });

        test('should fail when the login answer is not JSON', async () => {
            login(500, 'Some error happened.');

            await expect(core.fetchApplicationUser(1337)).rejects.toThrow('Malformed response when fetching auth request: Some error happened.');
        });

        test('should fail when the login is refused', async () => {
            login(403, { success: false, message: 'Refused' });

            await expect(core.fetchApplicationUser(1337)).rejects.toThrow('Error fetching auth request: ');
        });

        test('should fail when the member answer is not JSON', async () => {
            login(200, { success: true, access_token: 'service-token' });
            member(500, 'Some error happened.');

            await expect(core.fetchApplicationUser(1337)).rejects.toThrow('Malformed response when fetching user: Some error happened.');
        });

        test('should fail when core does not give the member', async () => {
            login(200, { success: true, access_token: 'service-token' });
            member(404, { success: false, message: 'User is not found.' });

            await expect(core.fetchApplicationUser(1337)).rejects.toThrow('Error fetching user: ');
        });
    });

    describe('fetching a body', () => {
        test('should return the body', async () => {
            nock(CORE).get('/bodies/34').reply(200, { success: true, data: { id: 34 } });

            await expect(core.getBody(req, 34)).resolves.toEqual({ id: 34 });
        });

        test('should return nothing for a body core does not know', async () => {
            nock(CORE).get('/bodies/34').reply(404, { success: false, message: 'Body is not found.' });

            await expect(core.getBody(req, 34)).resolves.toBeNull();
        });

        test.each([
            ['is not JSON', 500, 'Some error happened.', 'Malformed response when fetching bodies: Some error happened.'],
            ['is empty', 502, '', 'Malformed response when fetching bodies: null'],
            ['is an error', 500, { success: false, message: 'Some error' }, 'Error fetching body: ']
        ])('should fail when the answer %s', async (description, status, body, message) => {
            nock(CORE).get('/bodies/34').reply(status, body);

            await expect(core.getBody(req, 34)).rejects.toThrow(message);
        });

        test('should escape a body ID that is not a number', async () => {
            nock(CORE).get('/bodies/a%2Fb').reply(404, { success: false, message: 'Body is not found.' });

            await expect(core.getBody(req, 'a/b')).resolves.toBeNull();
        });
    });

    describe('fetching notification emails', () => {
        test.each([
            ['refuses', 403, { success: false, message: 'Refused' }],
            ['answers with something that is not JSON', 500, 'Some error happened.'],
            ['answers with nothing', 502, ''],
            ['answers without a list', 200, { success: true, data: null }]
        ])('should return an empty list when core %s', async (description, status, body) => {
            nock(CORE).get('/members_email?query=1,2').reply(status, body);

            await expect(core.getMails(req, '1,2')).resolves.toEqual([]);
        });
    });
});
