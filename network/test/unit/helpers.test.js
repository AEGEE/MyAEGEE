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

describe('getSorting', () => {
    test('should use an allowed sort field', () => {
        expect(helpers.getSorting({ sort: 'start_date', direction: 'desc' })).toEqual([['start_date', 'desc']]);
    });

    test('should ignore an unknown sort field', () => {
        expect(helpers.getSorting({ sort: 'lalala', direction: 'desc' })).toEqual([['id', 'desc']]);
        expect(helpers.getSorting({ sort: 'president' })).toEqual([['id', 'ASC']]);
    });
});

describe('getPermissions', () => {
    test('should not grant anything if the permissions list is not an array', () => {
        const permissions = helpers.getPermissions({ bodies: [] }, { combined: 'global:view:board' }, null);

        expect(permissions.view_board).toEqual(false);
        expect(permissions.manage_boards.global).toEqual(false);
    });

    test('should skip malformed permissions', () => {
        const permissions = helpers.getPermissions({ bodies: [] }, [
            null,
            {},
            { combined: 42 },
            { combined: 'global:view:board' }
        ], []);

        expect(permissions.view_board).toEqual(true);
        expect(permissions.manage_boards.global).toEqual(false);
    });

    test('should grant viewing boards only for the global view permission', () => {
        expect(helpers.getPermissions({ bodies: [] }, [{ combined: 'global:view:board' }], []).view_board).toEqual(true);
        expect(helpers.getPermissions({ bodies: [] }, [{ combined: 'local:view:board' }], []).view_board).toEqual(false);
        expect(helpers.getPermissions({ bodies: [] }, [{ combined: 'join_request:view:board' }], []).view_board).toEqual(false);
    });

    test('should grant no local board management without the user\'s bodies', () => {
        const permissions = helpers.getPermissions({}, [], [{ body_id: 34 }]);

        expect(permissions.manage_boards).toEqual({ global: false });
    });
});
