const helpers = require('../../lib/helpers');

describe('Helpers', () => {
    test('getMailText should show the claim time in UTC with minutes', () => {
        const text = helpers.getMailText({
            user: { first_name: 'Alex' },
            integration: { name: 'Partner', description: 'Description' },
            code: {
                value: 'SAVE-123',
                updated_at: new Date('2026-11-21T15:05:00.000+01:00')
            }
        });

        expect(text).toContain('Claimed on: 2026-11-21 14:05 UTC<br/>');
    });

    test('getPermissions should return false if permissions are not an array', () => {
        expect(helpers.getPermissions({}, null)).toEqual({ manage_discounts: false });
        expect(helpers.getPermissions({}, { combined: 'global:manage:discounts' })).toEqual({ manage_discounts: false });
    });

    test('getPermissions should skip permissions without a string combined', () => {
        const permissions = helpers.getPermissions({}, [
            null,
            {},
            { combined: 42 },
            { combined: 'global:manage:discounts' }
        ]);

        expect(permissions).toEqual({ manage_discounts: true });
    });

    test('getPermissions should return false if only malformed permissions are present', () => {
        const permissions = helpers.getPermissions({}, [null, {}, { combined: 42 }]);

        expect(permissions).toEqual({ manage_discounts: false });
    });
});
