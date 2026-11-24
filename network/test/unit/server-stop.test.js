const db = require('../../lib/sequelize');
const { startServer, stopServer } = require('../../lib/server');

describe('Server stop', () => {
    const env = process.env.NODE_ENV;

    afterEach(() => {
        process.env.NODE_ENV = env;
    });

    test('should leave the database open in tests, where test/setup.js closes it', async () => {
        const close = jest.spyOn(db, 'close');

        await startServer();
        await stopServer();

        expect(close).not.toHaveBeenCalled();
        close.mockRestore();
    });

    test('should close the database outside tests', async () => {
        const close = jest.spyOn(db, 'close').mockImplementation(async () => {});

        await startServer();
        process.env.NODE_ENV = 'production';
        await stopServer();

        expect(close).toHaveBeenCalledTimes(1);
        close.mockRestore();
    });
});
