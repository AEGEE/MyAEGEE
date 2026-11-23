const express = require('express');

const morgan = require('../../lib/morgan');
const log = require('../../lib/logger');

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
        app.put('/things/:id', (req, res) => res.json({ success: true }));

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

    const logRequest = async () => {
        const logged = new Promise((resolve) => {
            jest.spyOn(log, 'info').mockImplementation((...args) => resolve(args));
        });

        const res = await fetch(`${baseUrl}/things/12?query=${MARKER}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Auth-Token': MARKER,
                'X-Caller-Email': EMAIL
            },
            body: JSON.stringify({ passport_number: MARKER, email: EMAIL })
        });
        expect(res.status).toEqual(200);

        return logged;
    };

    it('should log the method, path, status, response time and user id', async () => {
        const [fields, message] = await logRequest();

        expect(message).toEqual('Request processed');
        expect(fields.method).toEqual('PUT');
        expect(fields.path).toEqual('/things/12');
        expect(fields.status).toEqual('200');
        expect(fields['response-time']).toEqual(expect.any(String));
        expect(fields.user_id).toEqual(USER_ID);
    });

    it('should not log the request body, headers, query string or user details', async () => {
        const [fields] = await logRequest();
        const written = JSON.stringify(fields);

        expect(written).not.toContain(MARKER);
        expect(written).not.toContain(EMAIL);
        expect(fields).not.toHaveProperty('body');
        expect(fields).not.toHaveProperty('headers');
        expect(fields).not.toHaveProperty('user');
    });
});
