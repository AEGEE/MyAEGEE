const log = require('../../lib/logger');
const Bugsnag = require('../../lib/bugsnag');
const { errorHandler } = require('../../lib/middlewares');

const makeRes = () => {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
};

describe('Error handler', () => {
    let errorLog;
    let notify;
    const env = process.env.NODE_ENV;

    beforeEach(() => {
        errorLog = jest.spyOn(log, 'error').mockImplementation(() => {});
        notify = jest.spyOn(Bugsnag, 'notify').mockImplementation(() => {});
    });

    afterEach(() => {
        process.env.NODE_ENV = env;
        notify.mockRestore();
        errorLog.mockRestore();
    });

    test('should answer 500 and not report to Bugsnag in tests', () => {
        const res = makeRes();
        const err = new Error('Query failed');

        errorHandler(err, {}, res, () => {});

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Query failed' });
        expect(errorLog).toHaveBeenCalledWith({ err }, 'Unhandled error');
        expect(notify).not.toHaveBeenCalled();
    });

    test('should report the error to Bugsnag outside tests', () => {
        const res = makeRes();
        const err = new Error('Query failed');
        process.env.NODE_ENV = 'production';

        errorHandler(err, {}, res, () => {});

        expect(notify).toHaveBeenCalledWith(err);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});
