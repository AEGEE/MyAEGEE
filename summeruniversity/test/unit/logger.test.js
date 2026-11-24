const bunyan = require('bunyan');

const log = require('../../lib/logger');

const realConfig = jest.requireActual('../../config');

// A fresh logger with the given logger configuration.
const loadLogger = (loggerConfig) => {
    let logger;
    jest.isolateModules(() => {
        jest.doMock('../../config', () => ({ ...realConfig, logger: loggerConfig }));
        logger = require('../../lib/logger'); // eslint-disable-line global-require
    });
    jest.dontMock('../../config');
    return logger;
};

describe('Logger', () => {
    it('should log only the message, name and stack of an error', () => {
        const err = new Error('Something went wrong');
        err.sql = 'UPDATE "things" SET "value"=$1';
        err.parameters = ['error-log-marker-7f3a'];

        const serialized = log.serializers.err(err);

        expect(serialized.message).toEqual('Something went wrong');
        expect(serialized.name).toEqual('Error');
        expect(serialized.stack).toEqual(expect.any(String));
        expect(JSON.stringify(serialized)).not.toContain('error-log-marker-7f3a');
    });

    it('should log nothing when silent', () => {
        const logger = loadLogger({ silent: true, level: 'debug' });

        expect(logger.level()).toEqual(bunyan.FATAL + 1);
    });

    it('should log from the configured level when not silent', () => {
        const logger = loadLogger({ silent: false, level: 'warn' });

        expect(logger.level()).toEqual(bunyan.WARN);
    });
});
