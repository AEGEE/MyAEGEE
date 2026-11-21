const helpers = require('../../lib/helpers');

describe('helpers.isNumber', () => {
    test.each([0, 1, 123, 2147483647, '0', '1', '123', '007', '2147483647'])('should accept %p', (value) => {
        expect(helpers.isNumber(value)).toEqual(true);
    });

    test.each([
        12.5, Number.NaN, Infinity, -1, 2147483648,
        '', '12.5', '1e3', ' 123 ', '0x1A', '-1', '+1', 'abc', '12abc', '123\n',
        '2147483648', '9'.repeat(309),
        null, undefined, true, {}, [1]
    ])('should reject %p', (value) => {
        expect(helpers.isNumber(value)).toEqual(false);
    });
});

describe('beautify', () => {
    test('should format dates with seconds, not fractional seconds', () => {
        expect(helpers.beautify(new Date(2024, 0, 2, 3, 4, 56, 789))).toEqual('2024-01-02 03:04:56');
    });
});
