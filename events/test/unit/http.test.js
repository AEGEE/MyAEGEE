const { default: nock } = require('nock');

const { request } = require('../../lib/http');

describe('HTTP client', () => {
    afterEach(() => {
        nock.cleanAll();
    });

    test('should send a request without headers', async () => {
        nock('http://http-client.test').get('/plain').reply(200, { ok: true });

        const body = await request({ url: 'http://http-client.test/plain' });

        expect(body).toEqual({ ok: true });
    });
});
