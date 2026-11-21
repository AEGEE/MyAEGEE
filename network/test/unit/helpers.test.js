const helpers = require('../../lib/helpers');

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
});
