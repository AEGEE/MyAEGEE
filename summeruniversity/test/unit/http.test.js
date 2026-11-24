const { default: nock } = require('nock');

const { request } = require('../../lib/http');

const BASE = 'http://http-client.test';

describe('HTTP client', () => {
    afterEach(() => {
        nock.cleanAll();
    });

    test('should send array query values as repeated parameters and objects in brackets', async () => {
        const scope = nock(BASE)
            .get('/members')
            .query((query) => {
                expect(query).toEqual({
                    id: ['1', '2'],
                    limit: '5',
                    'holds_permission[action]': 'approve_members',
                    'holds_permission[object]': 'summeruniversity'
                });
                return true;
            })
            .reply(200, { success: true });

        const body = await request({
            url: BASE + '/members',
            qs: { id: [1, 2], holds_permission: { action: 'approve_members', object: 'summeruniversity' }, limit: 5 }
        });

        expect(body).toEqual({ success: true });
        expect(scope.isDone()).toEqual(true);
    });

    test('should return null for an empty body', async () => {
        nock(BASE).get('/empty').reply(200, '');

        expect(await request({ url: BASE + '/empty' })).toEqual(null);
    });

    test('should return the text of a body that is not JSON', async () => {
        nock(BASE).get('/text').reply(500, 'Some error');

        const response = await request({ url: BASE + '/text', fullResponse: true });

        expect(response.statusCode).toEqual(500);
        expect(response.body).toEqual('Some error');
    });

    test('should keep a Content-Type the caller set', async () => {
        nock(BASE, { reqheaders: { 'Content-Type': 'application/vnd.custom+json' } })
            .post('/custom', { a: 1 })
            .reply(200, { success: true });

        const body = await request({
            url: BASE + '/custom',
            method: 'POST',
            headers: { 'Content-Type': 'application/vnd.custom+json' },
            body: { a: 1 }
        });

        expect(body).toEqual({ success: true });
    });
});
