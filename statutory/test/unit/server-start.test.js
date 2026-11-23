const net = require('net');

const config = require('../../config');
const { startServer } = require('../../lib/server');

describe('Server start', () => {
    test('should reject when the port is taken', async () => {
        const blocker = net.createServer();
        await new Promise((resolve) => {
            blocker.listen(config.port, resolve);
        });

        try {
            await expect(startServer()).rejects.toMatchObject({ code: 'EADDRINUSE' });
        } finally {
            await new Promise((resolve) => {
                blocker.close(resolve);
            });
        }
    });
});
