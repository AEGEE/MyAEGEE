const log = require('../../lib/logger');
const Bugsnag = require('../../lib/bugsnag');

describe('Unhandled rejection log', () => {
    const originalEnv = process.env.NODE_ENV;
    let handler;

    beforeAll(() => {
        const before = process.listeners('unhandledRejection');
        require('../../lib/server'); // eslint-disable-line global-require
        // The service's own handler, among the listeners its dependencies may add.
        handler = process.listeners('unhandledRejection')
            .find((listener) => !before.includes(listener) && String(listener).includes('Unhandled rejection'));
    });

    afterAll(() => {
        process.removeListener('unhandledRejection', handler);
    });

    afterEach(() => {
        process.env.NODE_ENV = originalEnv;
        jest.restoreAllMocks();
    });

    test('should log the error through the error serializer', () => {
        const errorLog = jest.spyOn(log, 'error').mockImplementation(() => {});
        const err = new Error('Query failed');

        handler(err);

        expect(errorLog).toHaveBeenCalledWith({ err }, 'Unhandled rejection');
    });

    test('should not report the error to the error tracker in the test environment', () => {
        jest.spyOn(log, 'error').mockImplementation(() => {});
        const notify = jest.spyOn(Bugsnag, 'notify').mockImplementation(() => {});

        handler(new Error('Query failed'));

        expect(notify).not.toHaveBeenCalled();
    });

    test('should report the error to the error tracker outside of the test environment', () => {
        const errorLog = jest.spyOn(log, 'error').mockImplementation(() => {});
        const notify = jest.spyOn(Bugsnag, 'notify').mockImplementation(() => {});
        const err = new Error('Query failed');
        process.env.NODE_ENV = 'production';

        handler(err);

        expect(notify).toHaveBeenCalledTimes(1);
        expect(notify).toHaveBeenCalledWith(err);
        expect(errorLog).toHaveBeenCalledWith({ err }, 'Unhandled rejection');
    });
});
