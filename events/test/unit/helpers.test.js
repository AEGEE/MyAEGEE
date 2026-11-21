const helpers = require('../../lib/helpers');

describe('beautify', () => {
    test('should format dates with seconds, not fractional seconds', () => {
        expect(helpers.beautify(new Date(2024, 0, 2, 3, 4, 56, 789))).toEqual('2024-01-02 03:04:56');
    });

    test('should display booleans as Yes/No', () => {
        expect(helpers.beautify(true)).toEqual('Yes');
        expect(helpers.beautify(false)).toEqual('No');
    });

    test('should return other values as they are', () => {
        expect(helpers.beautify('test')).toEqual('test');
    });
});
