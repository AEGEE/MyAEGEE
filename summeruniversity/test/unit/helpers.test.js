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

describe('getPermissions', () => {
    const user = { id: 1, bodies: [] };
    const asPermissions = (list) => list.map((combined) => ({ combined }));

    test('should grant global permissions', () => {
        const permissions = helpers.getPermissions(user, asPermissions([
            'global:manage_summeruniversity:regular',
            'global:approve_summeruniversity:pilot',
            'global:create:summeruniversity',
            'global:apply:summeruniversity',
            'global:manage_seasons:summeruniversity',
            'global:approve_members:summeruniversity',
            'global:edit:su_type',
            'global:edit:su_fee'
        ]), []);

        expect(permissions.manage_summeruniversity.regular).toEqual(true);
        expect(permissions.approve_summeruniversity.pilot).toEqual(true);
        expect(permissions.create_summeruniversity).toEqual(true);
        expect(permissions.apply_general).toEqual(true);
        expect(permissions.manage_seasons).toEqual(true);
        expect(permissions.see_boardview.global).toEqual(true);
        expect(permissions.edit_su_type).toEqual(true);
        expect(permissions.edit_su_fee).toEqual(true);
    });

    test('should only grant global rights for global permissions', () => {
        const permissions = helpers.getPermissions(user, asPermissions([
            'local:manage_summeruniversity:regular',
            'local:approve_summeruniversity:pilot',
            'local:create:summeruniversity',
            'local:apply:summeruniversity',
            'local:manage_seasons:summeruniversity',
            'local:approve_members:summeruniversity',
            'local:edit:su_type',
            'local:edit:su_fee'
        ]), []);

        expect(permissions.manage_summeruniversity.regular).toEqual(false);
        expect(permissions.approve_summeruniversity.pilot).toEqual(false);
        expect(permissions.create_summeruniversity).toEqual(false);
        expect(permissions.apply_general).toEqual(false);
        expect(permissions.manage_seasons).toEqual(false);
        expect(permissions.see_boardview.global).toEqual(false);
        expect(permissions.edit_su_type).toEqual(false);
        expect(permissions.edit_su_fee).toEqual(false);
    });

    test('should not match a permission that only ends like a known one', () => {
        const permissions = helpers.getPermissions(user, asPermissions(['global:not_manage_summeruniversity:regular']), []);

        expect(permissions.manage_summeruniversity.regular).toEqual(false);
    });
});
