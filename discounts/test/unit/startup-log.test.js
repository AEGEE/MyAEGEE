const { startServer, stopServer } = require('../../lib/server');
const log = require('../../lib/logger');
const config = require('../../config');

// Every configured password, token and key, wherever it sits in the configuration.
const collectSecrets = (object) => Object.entries(object).flatMap(([key, value]) => {
    if (value && typeof value === 'object') {
        return collectSecrets(value);
    }

    return /(password|token|secret|key)$/i.test(key) && typeof value === 'string' && value ? [value] : [];
});

describe('Startup log', () => {
    let logged;

    beforeAll(async () => {
        const spy = jest.spyOn(log, 'info');
        await startServer();
        logged = spy.mock.calls.map((args) => JSON.stringify(args));
        spy.mockRestore();
    });

    afterAll(async () => {
        await stopServer();
    });

    test('should log the host, port and environment', () => {
        const [fields] = JSON.parse(logged[0]);

        expect(fields).toEqual({ host: config.host, port: config.port, env: process.env.NODE_ENV });
    });

    test('should not log any password, token or key from the configuration', () => {
        const secrets = collectSecrets(config);
        expect(secrets).toContain(config.postgres.password);

        for (const line of logged) {
            for (const secret of secrets) {
                expect(line).not.toContain(secret);
            }
        }
    });
});
