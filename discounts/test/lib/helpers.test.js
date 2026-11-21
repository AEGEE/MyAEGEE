const helpers = require('../../lib/helpers');

describe('Helpers', () => {
    const mailTextFor = (updatedAt) => helpers.getMailText({
        user: { first_name: 'Alex' },
        integration: { name: 'Partner', description: 'Description' },
        code: { value: 'SAVE-123', updated_at: updatedAt }
    });

    test('getMailText should show the claim time in Brussels winter time (CET)', () => {
        expect(mailTextFor(new Date('2026-11-21T14:05:00.000Z'))).toContain('Claimed on: 2026-11-21 15:05 CET<br/>');
    });

    test('getMailText should show the claim time in Brussels summer time (CEST)', () => {
        expect(mailTextFor(new Date('2026-07-01T14:05:00.000Z'))).toContain('Claimed on: 2026-07-01 16:05 CEST<br/>');
    });

    test('getMailText should use the Brussels date around midnight UTC', () => {
        expect(mailTextFor('2026-12-31T23:30:00.000Z')).toContain('Claimed on: 2027-01-01 00:30 CET<br/>');
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
