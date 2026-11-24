const { Gauge } = require('prom-client');

const helpers = require('../../lib/helpers');

describe('Helpers', () => {
    const mailTextFor = (updatedAt) => helpers.getMailText({
        user: { first_name: 'Alex' },
        integration: { name: 'Partner', description: 'Description' },
        code: { value: 'SAVE-123', updated_at: updatedAt }
    });

    test('getMailText should include key claim details', () => {
        const text = helpers.getMailText({
            user: { first_name: 'Alex' },
            integration: {
                name: 'Flixbus',
                description: 'Ride cheaper across Europe'
            },
            code: {
                value: 'SAVE-123',
                updated_at: new Date('2024-01-02T03:04:00.000Z')
            }
        });

        expect(text).toContain('Hey Alex');
        expect(text).toContain('Partner: Flixbus');
        expect(text).toContain('Code: SAVE-123');
        expect(text).toContain('Ride cheaper across Europe');
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

    test('getMailText should insert the name and the partner texts as they are, without escaping', () => {
        // Today's behaviour, pinned so that a change to it is deliberate: the mail body is
        // HTML, and the description is the partner's Markdown, which may contain HTML.
        const text = helpers.getMailText({
            user: { first_name: '<b>Alex</b>' },
            integration: { name: 'A & B', description: '<a href="https://example.org">Shop</a>' },
            code: { value: 'SAVE-123', updated_at: new Date('2024-01-02T03:04:00.000Z') }
        });

        expect(text).toContain('Hey <b>Alex</b>');
        expect(text).toContain('Partner: A & B');
        expect(text).toContain('<a href="https://example.org">Shop</a>');
    });

    test('canClaimCodes should skip entries that are not bodies', () => {
        expect(helpers.canClaimCodes({ bodies: [null, { type: 'antenna', status: 'active' }] })).toEqual(true);
        expect(helpers.canClaimCodes({ bodies: [null] })).toEqual(false);
        expect(helpers.canClaimCodes(null)).toEqual(false);
    });

    test('getPermissions should expose manage_discounts', () => {
        const permissions = helpers.getPermissions({}, [
            { combined: 'global:manage:discounts' },
            { combined: 'global:view:members' }
        ]);

        expect(permissions).toEqual({ manage_discounts: true });
    });

    test('getPermissions should return false without discounts permission', () => {
        const permissions = helpers.getPermissions({}, [
            { combined: 'global:view:members' }
        ]);

        expect(permissions).toEqual({ manage_discounts: false });
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

    test('addGaugeData should reset existing values before setting new ones', async () => {
        const gauge = new Gauge({
            name: 'discounts_test_gauge',
            help: 'Test helper gauge',
            labelNames: ['category_name'],
            registers: []
        });

        helpers.addGaugeData(gauge, [{ category_name: 'Old', value: 3 }]);
        helpers.addGaugeData(gauge, [{ category_name: 'New', value: 5 }]);

        const metric = await gauge.get();

        expect(metric.values).toEqual([
            expect.objectContaining({
                labels: { category_name: 'New' },
                value: 5
            })
        ]);
    });
});
