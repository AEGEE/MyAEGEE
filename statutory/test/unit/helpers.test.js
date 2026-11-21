const helpers = require('../../lib/helpers');

describe('helpers.isNumber', () => {
    test('should accept integers and strings of digits', () => {
        for (const value of [0, 1, 123, '0', '1', '123', '007']) {
            expect(helpers.isNumber(value)).toEqual(true);
        }
    });

    test('should reject non-integer numbers', () => {
        for (const value of [12.5, Number.NaN, Infinity]) {
            expect(helpers.isNumber(value)).toEqual(false);
        }
    });

    test('should reject strings that are not only digits', () => {
        for (const value of ['', '12.5', '1e3', ' 123 ', '0x1A', '-1', '+1', 'abc', '12abc', '123\n']) {
            expect(helpers.isNumber(value)).toEqual(false);
        }
    });

    test('should reject values that are neither numbers nor strings', () => {
        for (const value of [null, undefined, true, {}, [1]]) {
            expect(helpers.isNumber(value)).toEqual(false);
        }
    });
});
