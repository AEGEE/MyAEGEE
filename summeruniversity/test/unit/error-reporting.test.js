const Bugsnag = require('../../lib/bugsnag');
const db = require('../../lib/sequelize');
const log = require('../../lib/logger');
const middlewares = require('../../lib/middlewares');
const { startServer, stopServer } = require('../../lib/server');

// Outside tests, errors go to Bugsnag and stopping the server closes the database. The
// tests run with NODE_ENV=test, so these set another environment for one call.
describe('Error reporting outside tests', () => {
    const environment = process.env.NODE_ENV;
    let notify;

    beforeEach(() => {
        notify = jest.spyOn(Bugsnag, 'notify').mockImplementation(() => {});
        jest.spyOn(log, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        process.env.NODE_ENV = environment;
        jest.restoreAllMocks();
    });

    test('should report an unhandled rejection to Bugsnag', () => {
        const handler = process.listeners('unhandledRejection')
            .find((listener) => String(listener).includes('Unhandled rejection'));
        const err = new Error('Query failed');

        process.env.NODE_ENV = 'production';
        handler(err);

        expect(notify).toHaveBeenCalledWith(err);
    });

    test('should report a request error to Bugsnag and answer 500', () => {
        const res = { status: jest.fn(() => res), json: jest.fn(() => res) };
        const err = new Error('Query failed');

        process.env.NODE_ENV = 'production';
        middlewares.errorHandler(err, {}, res, () => {});

        expect(notify).toHaveBeenCalledWith(err);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Query failed' });
    });

    test('should not report to Bugsnag in tests', () => {
        const res = { status: jest.fn(() => res), json: jest.fn(() => res) };

        middlewares.errorHandler(new Error('Query failed'), {}, res, () => {});

        expect(notify).not.toHaveBeenCalled();
    });

    test('should close the database when the server stops', async () => {
        await startServer();
        const close = jest.spyOn(db, 'close').mockResolvedValue();

        process.env.NODE_ENV = 'production';
        await stopServer();

        expect(close).toHaveBeenCalledTimes(1);
    });
});
