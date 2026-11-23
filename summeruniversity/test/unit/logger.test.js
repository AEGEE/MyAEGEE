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
