const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const packageInfo = require('../../package.json');

describe('General endpoints and error handling', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll();
    });

    afterEach(async () => {
        mock.cleanAll();
        await generator.clearAll();
    });

    describe('GET /healthcheck', () => {
        test('should return the service info without authentication', async () => {
            mock.mockAll({ core: { unauthorized: true }, mainPermissions: { unauthorized: true }, approvePermissions: { unauthorized: true } });

            const res = await request({ path: '/healthcheck', method: 'GET' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body.data).toEqual({
                name: packageInfo.name,
                description: packageInfo.description,
                version: packageInfo.version
            });
        });
    });

    describe('GET /metrics', () => {
        test('should return Prometheus metrics for events and applications', async () => {
            const event = await generator.createEvent({ name: 'Metrics SU' });
            await generator.createApplication(event, { user_id: 1, status: 'accepted' });
            await generator.createApplication(event, { user_id: 2, status: 'pending' });
            await generator.createApplication(event, { user_id: 3, status: 'pending', body_name: 'AEGEE-Dresden' });

            const res = await request({ path: '/metrics', method: 'GET', responseType: 'text' });

            expect(res.statusCode).toEqual(200);
            expect(res.headers['content-type']).toContain('text/plain');
            expect(res.body).toContain('summeruniversity_events_total{type="regular",status="second approval",deleted="false"} 1');
            expect(res.body).toContain('summeruniversity_applications_total{body_name="AEGEE-Alicante",status="pending",event_name="Metrics SU"} 1');
            expect(res.body).toContain('summeruniversity_applications_total{body_name="AEGEE-Dresden",status="pending",event_name="Metrics SU"} 1');
            expect(res.body).toContain('summeruniversity_applications_total{body_name="AEGEE-Alicante",status="accepted",event_name="Metrics SU"} 1');
            // The events service has its own events_applications_total; this service must not add to it.
            expect(res.body).not.toMatch(/^events_applications_total/m);
        });

        test('should work with an empty database', async () => {
            const res = await request({ path: '/metrics', method: 'GET', responseType: 'text' });

            expect(res.statusCode).toEqual(200);
            expect(res.body).toContain('summeruniversity_events_total');
        });
    });

    describe('GET /metrics/requests', () => {
        test('should count the requests made to the service', async () => {
            await request({ path: '/healthcheck', method: 'GET' });
            await request({ path: '/nonexistent-endpoint', method: 'GET', headers: { 'X-Auth-Token': 'foobar' }, skipOpenApi: 'the not-found handler' });

            const res = await request({ path: '/metrics/requests', method: 'GET', responseType: 'text' });

            expect(res.statusCode).toEqual(200);
            expect(res.body).toContain('summeruniversity_requests_total');
            expect(res.body).toMatch(/summeruniversity_requests_total\{status="200",path="\/healthcheck",method="GET"\} \d+/);
            expect(res.body).toMatch(/summeruniversity_requests_total\{status="404",path="unmatched",method="GET"\} \d+/);
        });
    });

    describe('requests without a token', () => {
        // Core is down: a request that asks it anything fails with 500.
        const coreDownMocks = { core: { netError: true }, mainPermissions: { netError: true }, approvePermissions: { netError: true } };

        test.each(['/', '/seasons', '/seasons/active'])('should answer GET %s without asking core', async (path) => {
            mock.mockAll(coreDownMocks);

            const res = await request({ path, method: 'GET' });

            expect(res.statusCode).toEqual(200);
        });

        test('should show a published event without asking core', async () => {
            mock.mockAll(coreDownMocks);
            const event = await generator.createEvent();

            const res = await request({ path: '/single/' + event.id, method: 'GET' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.permissions).not.toHaveProperty('apply');
        });

        test('should answer 401 on an authenticated route without asking core', async () => {
            mock.mockAll(coreDownMocks);

            const res = await request({ path: '/mine/organizing', method: 'GET' });

            expect(res.statusCode).toEqual(401);
            expect(res.body.message).toEqual('Error fetching data: user is not authenticated.');
        });
    });

    describe('error handling', () => {
        test('should return 404 on an unknown route', async () => {
            const res = await request({ path: '/nonexistent-endpoint', method: 'GET', headers: { 'X-Auth-Token': 'foobar' }, skipOpenApi: 'the not-found handler' });

            expect(res.statusCode).toEqual(404);
            expect(res.body.success).toEqual(false);
            expect(res.body.message).toEqual('No such API endpoint: GET /nonexistent-endpoint');
        });

        test('should return 404 on an unknown method for a known route', async () => {
            const event = await generator.createEvent();
            const res = await request({
                path: '/single/' + event.id + '/applications',
                method: 'DELETE',
                headers: { 'X-Auth-Token': 'foobar' },
                skipOpenApi: 'the not-found handler'
            });

            expect(res.statusCode).toEqual(404);
            expect(res.body.success).toEqual(false);
            expect(res.body.message).toContain('No such API endpoint: DELETE /single/' + event.id + '/applications');
        });

        test('should return 400 on malformed JSON', async () => {
            const res = await request({
                path: '/',
                method: 'POST',
                headers: { 'X-Auth-Token': 'foobar', 'Content-Type': 'application/json' },
                rawBody: '{"name": "not valid json"'
            });

            expect(res.statusCode).toEqual(400);
            expect(res.body.success).toEqual(false);
            expect(res.body.message).toEqual('Invalid JSON.');
        });

        test('should return 500 if core returns a non-JSON response for the user', async () => {
            mock.mockAll({ core: { badResponse: true } });

            const res = await request({ path: '/', method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.statusCode).toEqual(500);
            expect(res.body.success).toEqual(false);
            expect(res.body.message).toContain('Malformed response when fetching user');
        });

        test('should return 500 naming the malformed response if core returns an empty body for the user', async () => {
            mock.mockAll({ core: { emptyResponse: true } });

            const res = await request({ path: '/', method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.statusCode).toEqual(500);
            expect(res.body.message).toEqual('Malformed response when fetching user: null');
        });

        test('should return 500 if core returns an unsuccessful response for the user', async () => {
            mock.mockAll({ core: { unsuccessfulResponse: true } });

            const res = await request({ path: '/', method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.statusCode).toEqual(500);
            expect(res.body.success).toEqual(false);
            expect(res.body.message).toContain('Error fetching user');
        });

        test('should return 500 if core returns a non-JSON response for the permissions', async () => {
            mock.mockAll({ mainPermissions: { netError: true } });

            const res = await request({ path: '/', method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.statusCode).toEqual(500);
            expect(res.body.message).toContain('Malformed response when fetching permissions');
        });

        test('should return 500 if core returns an unsuccessful response for the approve permissions', async () => {
            mock.mockAll({ approvePermissions: { unsuccessfulResponse: true } });

            const res = await request({ path: '/', method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.statusCode).toEqual(500);
            expect(res.body.message).toContain('Error fetching permissions for approve');
        });

        test('should return 401 on a protected route if only the approve permissions request is unauthorized', async () => {
            mock.mockAll({ approvePermissions: { unauthorized: true } });

            const res = await request({ path: '/mine/organizing', method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.statusCode).toEqual(401);
            expect(res.body.success).toEqual(false);
        });
    });

    describe('CORS', () => {
        test('should set the CORS header on the public events listing for an allowed origin', async () => {
            const res = await request({ path: '/', method: 'GET', headers: { Origin: 'https://my.aegee.eu' } });

            expect(res.statusCode).toEqual(200);
            expect(res.headers['access-control-allow-origin']).toEqual('https://my.aegee.eu');
        });

        test('should not set the CORS header for a disallowed origin', async () => {
            const res = await request({ path: '/', method: 'GET', headers: { Origin: 'https://example.com' } });

            expect(res.statusCode).toEqual(200);
            expect(res.headers['access-control-allow-origin']).toBeUndefined();
        });

        test('should set the CORS header on the public event details', async () => {
            const event = await generator.createEvent();
            const res = await request({ path: '/single/' + event.id, method: 'GET', headers: { Origin: 'https://www.aegee.org' } });

            expect(res.statusCode).toEqual(200);
            expect(res.headers['access-control-allow-origin']).toEqual('https://www.aegee.org');
        });
    });
});
