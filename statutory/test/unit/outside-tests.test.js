const Bugsnag = require('../../lib/bugsnag');
const db = require('../../lib/sequelize');
const log = require('../../lib/logger');
const middlewares = require('../../lib/middlewares');
const { startServer, stopServer } = require('../../lib/server');

// Code that runs only when NODE_ENV is not 'test': reporting to Bugsnag and closing the
// database when the server stops.
describe('Outside tests', () => {
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
        process.env.NODE_ENV = 'production';
    });

    afterEach(() => {
        process.env.NODE_ENV = originalEnv;
        jest.restoreAllMocks();
    });

    test('the error handler should report an unhandled error to Bugsnag', () => {
        const notify = jest.spyOn(Bugsnag, 'notify').mockImplementation(() => {});
        const errorLog = jest.spyOn(log, 'error').mockImplementation(() => {});
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
        const err = new Error('Something broke');

        middlewares.errorHandler(err, {}, res, () => {});

        expect(notify).toHaveBeenCalledWith(err);
        expect(errorLog).toHaveBeenCalledWith({ err });
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Something broke' });
    });

    test('stopping the server should close the database', async () => {
        const close = jest.spyOn(db, 'close').mockResolvedValue();

        await startServer();
        await stopServer();

        expect(close).toHaveBeenCalledTimes(1);
    });
});
