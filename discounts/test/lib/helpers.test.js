const { Gauge } = require('prom-client');

const helpers = require('../../lib/helpers');

describe('Helpers', () => {
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
