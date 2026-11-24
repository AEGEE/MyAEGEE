const Bugsnag = require('../../lib/bugsnag');
const db = require('../../lib/sequelize');
const log = require('../../lib/logger');
const middlewares = require('../../lib/middlewares');
const mailer = require('../../lib/mailer');
const { startServer, stopServer } = require('../../lib/server');

// Code that runs only when NODE_ENV is not 'test': reporting to Bugsnag (an unhandled error,
// a mail about a saved change that failed) and closing the database when the server stops.
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
        // The error is in the log; the answer has a fixed text.
        expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Internal server error.' });
    });

    test('a mail about a saved change that fails should be reported to Bugsnag with its template and ids', async () => {
        const event = { addMetadata: jest.fn() };
        const notify = jest.spyOn(Bugsnag, 'notify').mockImplementation((err, onError) => onError(event));
        jest.spyOn(log, 'error').mockImplementation(() => {});
        const err = new Error('The mailer is down');

        await mailer.sendMailAfterSave({ template: 'statutory_applied.html', ids: { application_id: 1, event_id: 2 } }, () => {
            throw err;
        });

        expect(notify).toHaveBeenCalledWith(err, expect.any(Function));
        expect(event.addMetadata).toHaveBeenCalledWith('mail', { template: 'statutory_applied.html', application_id: 1, event_id: 2 });
    });

    test('stopping the server should close the database', async () => {
        const close = jest.spyOn(db, 'close').mockResolvedValue();

        await startServer();
        await stopServer();

        expect(close).toHaveBeenCalledTimes(1);
    });
});
