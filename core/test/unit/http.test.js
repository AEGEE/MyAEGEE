const nock = require('nock');

const { request } = require('../../lib/http');
const { startSilentServer } = require('../scripts/silent-server');

const HOST = 'http://other-service.test';

describe('HTTP client', () => {
    afterEach(() => {
        nock.cleanAll();
    });

    describe('the method', () => {
        test('should be GET if none is given', async () => {
            const scope = nock(HOST).get('/things').reply(200, { success: true });

            const body = await request({ url: HOST + '/things' });

            expect(scope.isDone()).toEqual(true);
            expect(body).toEqual({ success: true });
        });

        test('should be the given one', async () => {
            const scope = nock(HOST).delete('/things/1').reply(200, { success: true });

            await request({ url: HOST + '/things/1', method: 'DELETE' });

            expect(scope.isDone()).toEqual(true);
        });
    });

    describe('the headers', () => {
        test('should be sent as given', async () => {
            const scope = nock(HOST, { reqheaders: { 'x-auth-token': 'a-token' } })
                .get('/things')
                .reply(200, {});

            await request({ url: HOST + '/things', headers: { 'x-auth-token': 'a-token' } });

            expect(scope.isDone()).toEqual(true);
        });

        test('should not be changed in the object of the caller', async () => {
            nock(HOST).post('/things').reply(200, {});
            const headers = { 'x-auth-token': 'a-token' };

            await request({ url: HOST + '/things', method: 'POST', headers, body: {} });

            expect(headers).toEqual({ 'x-auth-token': 'a-token' });
        });
    });

    describe('the query', () => {
        test('should leave the URL as it is if there is none', async () => {
            const scope = nock(HOST).get('/things?page=2').reply(200, {});

            await request({ url: HOST + '/things?page=2' });

            expect(scope.isDone()).toEqual(true);
        });

        test('should add plain values to the URL', async () => {
            const scope = nock(HOST).get('/things?limit=10&query=two%20words&all=true').reply(200, {});

            await request({ url: HOST + '/things', qs: { limit: 10, query: 'two words', all: true } });

            expect(scope.isDone()).toEqual(true);
        });

        test('should repeat the name for each item of a list', async () => {
            let path;
            nock(HOST).get(/^\/things/).reply(200, function reply() {
                path = this.req.path;
                return {};
            });

            await request({ url: HOST + '/things', qs: { ids: [1, 2, 3] } });

            expect(path).toEqual('/things?ids=1&ids=2&ids=3');
        });

        test('should write the fields of an object in brackets', async () => {
            let path;
            nock(HOST).get(/^\/things/).reply(200, function reply() {
                path = this.req.path;
                return {};
            });

            await request({ url: HOST + '/things', qs: { filter: { status: 'accepted', body_id: 5 } } });

            expect(decodeURIComponent(path)).toEqual('/things?filter[status]=accepted&filter[body_id]=5');
        });

        test('should add to a query that the URL has already', async () => {
            let path;
            nock(HOST).get(/^\/things/).reply(200, function reply() {
                path = this.req.path;
                return {};
            });

            await request({ url: HOST + '/things?page=2', qs: { limit: 10 } });

            expect(path).toEqual('/things?page=2&limit=10');
        });
    });

    describe('the request body', () => {
        test('should be sent as JSON', async () => {
            const scope = nock(HOST, { reqheaders: { 'content-type': 'application/json' } })
                .post('/things', { name: 'Thing', tags: ['a', 'b'] })
                .reply(201, { success: true });

            await request({ url: HOST + '/things', method: 'POST', body: { name: 'Thing', tags: ['a', 'b'] } });

            expect(scope.isDone()).toEqual(true);
        });

        test('should be sent for a value that is empty, like false', async () => {
            let sent;
            nock(HOST).put('/things/1/active').reply(200, (uri, requestBody) => {
                sent = requestBody;
                return {};
            });

            await request({ url: HOST + '/things/1/active', method: 'PUT', body: false });

            expect(sent).toEqual(false);
        });

        test('should keep a content type that the caller gives', async () => {
            const scope = nock(HOST, { reqheaders: { 'content-type': 'application/vnd.api+json' } })
                .post('/things', { name: 'Thing' })
                .reply(201, {});

            await request({
                url: HOST + '/things',
                method: 'POST',
                headers: { 'Content-Type': 'application/vnd.api+json' },
                body: { name: 'Thing' }
            });

            expect(scope.isDone()).toEqual(true);
        });

        test('should not be sent, nor a content type, if there is none', async () => {
            let headers;
            let sent;
            nock(HOST).post('/things').reply(200, function reply(uri, requestBody) {
                headers = this.req.headers;
                sent = requestBody;
                return {};
            });

            await request({ url: HOST + '/things', method: 'POST' });

            expect(sent).toEqual('');
            expect(headers['content-type']).toBeUndefined();
        });
    });

    describe('a form', () => {
        test('should be sent URL-encoded', async () => {
            let headers;
            let sent;
            nock(HOST).post('/subscribe').reply(200, function reply(uri, requestBody) {
                headers = this.req.headers;
                sent = requestBody;
                return 'OK';
            });

            await request({
                url: HOST + '/subscribe',
                method: 'POST',
                form: { email: 'member@example.com', list: 'ANNOUNCE-L & more' }
            });

            expect(headers['content-type']).toEqual('application/x-www-form-urlencoded');
            expect(sent).toEqual('email=member%40example.com&list=ANNOUNCE-L+%26+more');
        });

        test('should keep a content type that the caller gives', async () => {
            const scope = nock(HOST, { reqheaders: { 'content-type': 'application/x-www-form-urlencoded; charset=utf-8' } })
                .post('/subscribe', 'email=member%40example.com')
                .reply(200, 'OK');

            await request({
                url: HOST + '/subscribe',
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
                form: { email: 'member@example.com' }
            });

            expect(scope.isDone()).toEqual(true);
        });
    });

    describe('form data', () => {
        test('should be sent as multipart, with the boundary that fetch chooses', async () => {
            let headers;
            let sent;
            nock(HOST).post('/upload').reply(200, function reply(uri, requestBody) {
                headers = this.req.headers;
                sent = requestBody;
                return {};
            });
            const formData = new FormData();
            formData.append('summary', 'A bug');

            await request({ url: HOST + '/upload', method: 'POST', formData });

            expect(headers['content-type']).toMatch(/^multipart\/form-data; boundary=/);
            expect(sent).toContain('name="summary"');
            expect(sent).toContain('A bug');
        });
    });

    describe('the response body', () => {
        test('should be null if the response has none', async () => {
            nock(HOST).delete('/things/1').reply(204);

            const body = await request({ url: HOST + '/things/1', method: 'DELETE' });

            expect(body).toBeNull();
        });

        test('should be null for an empty text', async () => {
            nock(HOST).get('/things').reply(200, '');

            const body = await request({ url: HOST + '/things' });

            expect(body).toBeNull();
        });

        test('should be parsed if it is JSON', async () => {
            nock(HOST).get('/things').reply(200, { success: true, data: [{ id: 1 }] });

            const body = await request({ url: HOST + '/things' });

            expect(body).toEqual({ success: true, data: [{ id: 1 }] });
        });

        test('should be the text if it is not JSON', async () => {
            nock(HOST).get('/things').reply(502, '<html>Bad gateway</html>');

            const body = await request({ url: HOST + '/things' });

            expect(body).toEqual('<html>Bad gateway</html>');
        });

        test('should be given for an error status too, without throwing', async () => {
            nock(HOST).get('/things/1').reply(404, { success: false, message: 'Not found.' });

            const body = await request({ url: HOST + '/things/1' });

            expect(body).toEqual({ success: false, message: 'Not found.' });
        });
    });

    describe('the full response', () => {
        test('should give the status, the headers and the body', async () => {
            nock(HOST).get('/things/1').reply(404, { success: false }, { 'X-Request-Id': 'abc' });

            const response = await request({ url: HOST + '/things/1', fullResponse: true });

            expect(response).toEqual({
                statusCode: 404,
                statusMessage: 'Not Found',
                headers: expect.objectContaining({ 'x-request-id': 'abc', 'content-type': 'application/json' }),
                body: { success: false }
            });
        });

        test('should have null as the body of a response without one', async () => {
            nock(HOST).delete('/things/1').reply(204);

            const response = await request({ url: HOST + '/things/1', method: 'DELETE', fullResponse: true });

            expect(response.statusCode).toEqual(204);
            expect(response.body).toBeNull();
        });
    });

    describe('a failing request', () => {
        test('should reject with the error of fetch', async () => {
            nock(HOST).get('/things').replyWithError(new Error('connection refused'));

            const err = await request({ url: HOST + '/things' }).catch((e) => e);

            expect(err).toBeInstanceOf(Error);
        });
    });

    describe('the timeout', () => {
        let silentServer;

        beforeEach(async () => {
            silentServer = await startSilentServer();
        });

        afterEach(async () => {
            await silentServer.close();
        });

        test('should give up a request that is not answered in time', async () => {
            const started = Date.now();

            const err = await request({ url: `http://127.0.0.1:${silentServer.port}/things`, timeout: 200 }).catch((e) => e);

            expect(err.name).toEqual('TimeoutError');
            expect(silentServer.requests).toEqual(1);
            expect(Date.now() - started).toBeLessThan(5000);
        });

        test('should not get in the way of a request that is answered in time', async () => {
            nock(HOST).get('/things').reply(200, { success: true });

            const body = await request({ url: HOST + '/things', timeout: 5000 });

            expect(body).toEqual({ success: true });
        });
    });
});
