const express = require('express');

const morgan = require('../../lib/morgan');
const log = require('../../lib/logger');
// Each router mount records its pattern with this helper.
const { recordMountPath } = require('../../lib/endpoints_metrics');

// Values that stand for personal data and must not reach the request log.
const MARKER = 'request-log-marker-7f3a';
const EMAIL = 'request-log-caller@example.org';
const USER_ID = 4242;

describe('Request log', () => {
    let server;
    let baseUrl;

    beforeAll(async () => {
        const app = express();
        app.use(express.json());
        app.use(morgan);
        // Like the authorization middlewares, which run after the request logger.
        app.use((req, res, next) => {
            req.user = {
                id: USER_ID,
                username: MARKER,
                first_name: MARKER,
                last_name: MARKER,
                email: EMAIL,
                notification_email: EMAIL
            };
            next();
        });

        // Mounted like the services' routers, with a lookup middleware in front of the routes.
        const MemberRouter = express.Router({ mergeParams: true });
        MemberRouter.use((req, res, next) => (req.params.user_id === 'missing'
            ? res.status(404).json({ success: false })
            : next()));
        MemberRouter.put('/', (req, res) => res.json({ success: true }));
        MemberRouter.get('/things/:thing_id', (req, res) => res.json({ success: true }));
        MemberRouter.get('/broken', (req, res, next) => next(new Error('broken')));

        const GeneralRouter = express.Router({ mergeParams: true });
        GeneralRouter.get('/healthcheck', (req, res) => res.json({ success: true }));

        app.get('/direct/:id', (req, res) => res.json({ success: true }));
        app.use('/members/:user_id', recordMountPath('/members/:user_id'), MemberRouter);
        app.use('/', recordMountPath('/'), GeneralRouter);
        app.use((req, res) => res.status(404).json({ success: false }));
        app.use((err, req, res, next) => res.status(500).json({ success: false })); // eslint-disable-line no-unused-vars

        await new Promise((resolve) => {
            server = app.listen(0, '127.0.0.1', resolve);
        });
        baseUrl = `http://127.0.0.1:${server.address().port}`;
    });

    afterAll(() => new Promise((resolve) => {
        server.close(resolve);
    }));

    afterEach(() => {
        jest.restoreAllMocks();
    });

    const logRequest = async (path, method = 'GET', expectedStatus = 200) => {
        const logged = new Promise((resolve) => {
            jest.spyOn(log, 'info').mockImplementation((...args) => resolve(args));
        });

        const res = await fetch(`${baseUrl}${path}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'X-Auth-Token': MARKER,
                'X-Caller-Email': EMAIL
            },
            body: method === 'GET' ? undefined : JSON.stringify({ passport_number: MARKER, email: EMAIL })
        });
        expect(res.status).toEqual(expectedStatus);

        return logged;
    };

    it('should log the method, route pattern, status, response time and user id', async () => {
        const [fields, message] = await logRequest(`/members/${MARKER}?query=${MARKER}`, 'PUT');

        expect(message).toEqual('Request processed');
        expect(fields.method).toEqual('PUT');
        expect(fields.path).toEqual('/members/:user_id');
        expect(fields.status).toEqual('200');
        expect(fields['response-time']).toEqual(expect.any(String));
        expect(fields.user_id).toEqual(USER_ID);
    });

    it('should not log the request body, headers, query string, concrete path or user details', async () => {
        const [fields] = await logRequest(`/members/${MARKER}?query=${MARKER}`, 'PUT');
        const written = JSON.stringify(fields);

        expect(written).not.toContain(MARKER);
        expect(written).not.toContain(EMAIL);
        expect(fields).not.toHaveProperty('body');
        expect(fields).not.toHaveProperty('headers');
        expect(fields).not.toHaveProperty('user');
    });

    it('should log the route pattern of a route inside a mounted router', async () => {
        const [fields] = await logRequest(`/members/${MARKER}/things/12`);

        expect(fields.path).toEqual('/members/:user_id/things/:thing_id');
    });

    it('should log the route pattern of a route on the application', async () => {
        const [fields] = await logRequest(`/direct/${MARKER}`);

        expect(fields.path).toEqual('/direct/:id');
    });

    it('should log the route pattern of a route in a router mounted on /', async () => {
        const [fields] = await logRequest('/healthcheck');

        expect(fields.path).toEqual('/healthcheck');
    });

    it('should log the mount pattern when a router middleware answers before a route matched', async () => {
        const [fields] = await logRequest('/members/missing', 'GET', 404);

        expect(fields.path).toEqual('/members/:user_id');
        expect(fields.status).toEqual('404');
    });

    it('should log the route pattern when a route passes an error on', async () => {
        const [fields] = await logRequest(`/members/${MARKER}/broken`, 'GET', 500);

        expect(fields.path).toEqual('/members/:user_id/broken');
        expect(fields.status).toEqual('500');
    });

    it('should not log what follows the mount in the URL when no route matched inside it', async () => {
        const [fields] = await logRequest(`/members/missing/${MARKER}/12`, 'GET', 404);

        expect(fields.path).toEqual('/members/:user_id/*');
        expect(JSON.stringify(fields)).not.toContain(MARKER);
    });

    it('should not log the path when no route matched', async () => {
        const [fields] = await logRequest(`/unknown/${MARKER}?query=${MARKER}`, 'GET', 404);

        expect(fields.path).toEqual('unmatched');
        expect(fields.status).toEqual('404');
        expect(JSON.stringify(fields)).not.toContain(MARKER);
    });

    it('should not log the path when the path is known but the method is not', async () => {
        const [fields] = await logRequest(`/members/${MARKER}`, 'PATCH', 404);

        expect(fields.path).toEqual('unmatched');
        expect(JSON.stringify(fields)).not.toContain(MARKER);
    });
});
