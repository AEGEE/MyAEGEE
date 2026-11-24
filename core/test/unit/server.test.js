const net = require('net');

const { startServer, stopServer } = require('../../lib/server');
const config = require('../../config');
const cron = require('../../lib/cron');
const db = require('../../lib/sequelize');

const isListening = () => new Promise((resolve) => {
    const socket = net.connect(config.port, '127.0.0.1');
    socket.once('connect', () => {
        socket.destroy();
        resolve(true);
    });
    socket.once('error', () => resolve(false));
});

const closeServer = (server) => new Promise((resolve) => {
    server.close(resolve);
});

describe('Server', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
        process.env.NODE_ENV = originalEnv;
        jest.restoreAllMocks();
    });

    describe('on a port that is taken', () => {
        let blocker;

        beforeEach(async () => {
            blocker = net.createServer();
            await new Promise((resolve) => {
                blocker.listen(config.port, resolve);
            });
        });

        afterEach(async () => {
            if (blocker.listening) await closeServer(blocker);
        });

        test('should fail to start, with the error of the port', async () => {
            const authenticate = jest.spyOn(db, 'authenticate');

            const err = await startServer().catch((e) => e);

            expect(err.code).toEqual('EADDRINUSE');
            expect(err.syscall).toEqual('listen');
            expect(err.port).toEqual(config.port);
            expect(authenticate).not.toHaveBeenCalled();
        });

        test('should start once the port is free again', async () => {
            await expect(startServer()).rejects.toMatchObject({ code: 'EADDRINUSE' });
            await closeServer(blocker);

            await startServer();

            expect(await isListening()).toEqual(true);
            await stopServer();
        });
    });

    describe('in the test environment', () => {
        test('should not schedule the cron jobs and should leave the database connection open', async () => {
            const registerAllTasks = jest.spyOn(cron, 'registerAllTasks');
            const close = jest.spyOn(db, 'close');

            await startServer();
            expect(await isListening()).toEqual(true);
            await stopServer();

            expect(registerAllTasks).not.toHaveBeenCalled();
            expect(close).not.toHaveBeenCalled();
        });
    });

    describe('outside of the test environment', () => {
        test('should schedule the cron jobs at the start', async () => {
            const registerAllTasks = jest.spyOn(cron, 'registerAllTasks').mockResolvedValue();
            const authenticate = jest.spyOn(db, 'authenticate');
            jest.spyOn(db, 'close').mockResolvedValue();
            process.env.NODE_ENV = 'production';

            await startServer();

            expect(registerAllTasks).toHaveBeenCalledTimes(1);
            // The jobs read the database, so they are scheduled after it is connected.
            expect(authenticate.mock.invocationCallOrder[0]).toBeLessThan(registerAllTasks.mock.invocationCallOrder[0]);
            await stopServer();
        });

        test('should close the database connection at the stop', async () => {
            jest.spyOn(cron, 'registerAllTasks').mockResolvedValue();
            const close = jest.spyOn(db, 'close').mockResolvedValue();
            process.env.NODE_ENV = 'production';
            await startServer();
            expect(close).not.toHaveBeenCalled();

            await stopServer();

            expect(close).toHaveBeenCalledTimes(1);
            // Stopped listening as well.
            await new Promise((resolve) => {
                setTimeout(resolve, 50);
            });
            expect(await isListening()).toEqual(false);
        });
    });
});
