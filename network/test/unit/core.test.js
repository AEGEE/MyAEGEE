const { default: nock } = require('nock');

const config = require('../../config');
const core = require('../../lib/core');

const CORE = `${config.core.url}:${config.core.port}`;

describe('Core client', () => {
    afterEach(() => {
        nock.cleanAll();
    });

    describe('getMails', () => {
        test('should log in as the service user and return the addresses', async () => {
            nock(CORE).post('/login').reply(200, { success: true, access_token: 'service-token' });
            nock(CORE, { reqheaders: { 'x-auth-token': 'service-token' } })
                .get('/members_email?query=1,2')
                .reply(200, { success: true, data: [{ id: 1, notification_email: 'one@example.org' }] });

            await expect(core.getMails('1,2')).resolves.toEqual([{ id: 1, notification_email: 'one@example.org' }]);
        });

        test('should use the given token instead of logging in', async () => {
            nock(CORE, { reqheaders: { 'x-auth-token': 'user-token' } })
                .get('/members_email?query=1')
                .reply(200, { success: true, data: [] });

            await expect(core.getMails('1', 'user-token')).resolves.toEqual([]);
        });

        test('should fail if the login answer is not JSON', async () => {
            nock(CORE).post('/login').reply(500, 'Some error happened.');

            await expect(core.getMails('1')).rejects.toThrow('Malformed response when fetching auth request');
        });

        test('should fail if the login is refused', async () => {
            nock(CORE).post('/login').reply(422, { success: false, message: 'Login is incorrect.' });

            await expect(core.getMails('1')).rejects.toThrow('Error fetching auth request');
        });
    });
});
