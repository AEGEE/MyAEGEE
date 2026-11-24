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
            'global:manage_event:nwm',
            'global:approve_event:training',
            'global:change_european_event_status:cultural',
            'global:create:event'
        ]), []);

        expect(permissions.manage_event.nwm).toEqual(true);
        expect(permissions.approve_event.training).toEqual(true);
        expect(permissions.change_european_event_status.cultural).toEqual(true);
        expect(permissions.create_event).toEqual(true);
    });

    test('should only grant global rights for global permissions', () => {
        const permissions = helpers.getPermissions(user, asPermissions([
            'local:manage_event:nwm',
            'local:approve_event:training',
            'local:change_european_event_status:cultural',
            'local:create:event'
        ]), []);

        expect(permissions.manage_event.nwm).toEqual(false);
        expect(permissions.approve_event.training).toEqual(false);
        expect(permissions.change_european_event_status.cultural).toEqual(false);
        expect(permissions.create_event).toEqual(false);
    });

    test('should not match a permission that only ends like a known one', () => {
        const permissions = helpers.getPermissions(user, asPermissions(['global:not_manage_event:nwm']), []);

        expect(permissions.manage_event.nwm).toEqual(false);
    });
});
