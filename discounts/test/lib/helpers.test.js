const { Gauge } = require('prom-client');

const helpers = require('../../lib/helpers');

describe('Helpers', () => {
    test('isNumber should accept numbers and numeric strings', () => {
        expect(helpers.isNumber(123)).toEqual(true);
        expect(helpers.isNumber('123')).toEqual(true);
        expect(helpers.isNumber('12.5')).toEqual(true);
    });

    test('isNumber should reject non-numeric values', () => {
        expect(helpers.isNumber('abc')).toEqual(false);
        expect(helpers.isNumber({})).toEqual(false);
        expect(helpers.isNumber(undefined)).toEqual(false);
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
        expect(text).toContain('Claimed on: 2024-01-02 03:04');
    });

    test('getPermissions should expose manage_discounts', () => {
        const permissions = helpers.getPermissions({}, [
            { combined: 'oms:manage:discounts' },
            { combined: 'oms:view:members' }
        ]);

        expect(permissions).toEqual({ manage_discounts: true });
    });

    test('getPermissions should return false without discounts permission', () => {
        const permissions = helpers.getPermissions({}, [
            { combined: 'oms:view:members' }
        ]);

        expect(permissions).toEqual({ manage_discounts: false });
    });

    test('getPermissions should return false for malformed permissions payload', () => {
        const permissions = helpers.getPermissions({}, null);

        expect(permissions).toEqual({ manage_discounts: false });
    });

    test('addGaugeData should reset existing values before setting new ones', async () => {
        const gauge = new Gauge({
            name: 'discounts_test_gauge_unique',
            help: 'Test helper gauge',
            labelNames: ['category_name']
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
