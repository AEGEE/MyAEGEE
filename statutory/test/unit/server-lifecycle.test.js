const config = require('../../config');

config.port = 0;

const { startServer, stopServer } = require('../../lib/server');

describe('statutory server lifecycle', () => {
    afterEach(async () => {
        await stopServer();
    });

    test('allows concurrent start calls without rebinding the port', async () => {
        await expect(Promise.all([startServer(), startServer()])).resolves.toHaveLength(2);
    });

    test('allows concurrent stop calls after the server is started', async () => {
        await startServer();

        await expect(Promise.all([stopServer(), stopServer()])).resolves.toHaveLength(2);
    });
});
