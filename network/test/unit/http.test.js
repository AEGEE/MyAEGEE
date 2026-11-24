const { default: nock } = require('nock');

const { request } = require('../../lib/http');

const HOST = 'http://http-client.test';

describe('HTTP client', () => {
    afterEach(() => {
        nock.cleanAll();
    });

    test('should send a GET without headers by default and parse JSON', async () => {
        nock(HOST).get('/json').reply(200, { success: true });

        await expect(request({ url: HOST + '/json' })).resolves.toEqual({ success: true });
    });

    test('should return null for an empty body', async () => {
        nock(HOST).get('/empty').reply(204);

        await expect(request({ url: HOST + '/empty' })).resolves.toBeNull();
    });

    test('should return the text of a body that is not JSON', async () => {
        nock(HOST).get('/text').reply(500, 'Some error happened.');

        await expect(request({ url: HOST + '/text' })).resolves.toEqual('Some error happened.');
    });

    test('should keep a Content-Type the caller sets', async () => {
        nock(HOST, { reqheaders: { 'content-type': 'application/vnd.test+json' } })
            .post('/typed', { value: 1 })
            .reply(200, { success: true });

        const res = await request({
            url: HOST + '/typed',
            method: 'POST',
            headers: { 'Content-Type': 'application/vnd.test+json' },
            body: { value: 1 },
            fullResponse: true
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual({ success: true });
        expect(res.headers['content-type']).toContain('application/json');
    });
});
