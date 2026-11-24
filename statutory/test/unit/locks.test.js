const { isLockTimeout } = require('../../lib/locks');

// A wait for a lock that Postgres ended, by the lock timeout or as a deadlock, is answered
// with 503: the transaction was rolled back and nothing was changed.
describe('Lock waits that Postgres ended', () => {
    test.each([['55P03', true], ['40P01', true], ['23505', false]])('the error code %s is one: %s', (code, expected) => {
        expect(isLockTimeout({ parent: { code } })).toEqual(expected);
    });

    test('an error without a database error is none', () => {
        expect(isLockTimeout(new Error('Something else'))).toEqual(false);
    });
});
