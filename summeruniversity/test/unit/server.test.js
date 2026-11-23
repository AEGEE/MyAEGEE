const net = require('net');

const { startServer } = require('../../lib/server');
const config = require('../../config');

describe('Server start', () => {
    let blocker;

    beforeAll(async () => {
        blocker = net.createServer();
        await new Promise((resolve) => {
            blocker.listen(config.port, resolve);
        });
    });

    afterAll(async () => {
        await new Promise((resolve) => {
            blocker.close(resolve);
        });
    });

    test('should reject if the port is already in use', async () => {
        await expect(startServer()).rejects.toThrow(/EADDRINUSE/);
    });
});
