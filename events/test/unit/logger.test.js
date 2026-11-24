const log = require('../../lib/logger');

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
});

describe('Logger level', () => {
    const levelWith = (logger) => {
        let level;
        jest.isolateModules(() => {
            const config = require('../../config'); // eslint-disable-line global-require
            Object.assign(config.logger, logger);
            level = require('../../lib/logger').level(); // eslint-disable-line global-require
        });
        return level;
    };

    test('logs nothing when silent', () => {
        expect(levelWith({ silent: true })).toBeGreaterThan(60);
    });

    test('logs from the configured level otherwise', () => {
        expect(levelWith({ silent: false, level: 'warn' })).toEqual(40);
    });
});
