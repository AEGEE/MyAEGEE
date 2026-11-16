const http = require('http');

jest.mock('../../lib/logger', () => ({ info: jest.fn() }));

const log = require('../../lib/logger');
const requestLogger = require('../../lib/morgan');

const sendRequest = (user, body) => new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
        req.user = user;
        req.body = body;
        requestLogger(req, res, () => {});
        res.setHeader('content-length', 2);
        res.end('ok');
    });

    server.listen(0, () => {
        const request = http.request({ port: server.address().port, path: '/votings?page=1', method: 'POST' }, (res) => {
            res.resume();
            res.on('end', () => server.close(resolve));
        });
        request.on('error', reject);
        request.end();
    });
});

describe('Request logging', () => {
    beforeEach(() => log.info.mockClear());

    test('logs request metadata and the user id, but no body, name or e-mail', async () => {
        await sendRequest(
            { id: 42, username: 'jdoe', first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' },
            { first_name: 'Jane', email: 'jane@example.com', note: 'private' }
        );

        expect(log.info).toHaveBeenCalledTimes(1);
        const [entry, message] = log.info.mock.calls[0];

        expect(message).toBe('Request processed');
        expect(entry).toMatchObject({ method: 'POST', url: '/votings?page=1', status: '200', length: 2, user: { id: 42 } });
        expect(entry['response-time']).toEqual(expect.any(String));

        const output = JSON.stringify(log.info.mock.calls);
        ['Jane', 'Doe', 'jdoe', 'jane@example.com', 'private'].forEach((secret) => {
            expect(output).not.toContain(secret);
        });
    });

    test('logs no user for anonymous requests', async () => {
        await sendRequest(undefined, undefined);

        expect(log.info.mock.calls[0][0].user).toBeUndefined();
    });
});
