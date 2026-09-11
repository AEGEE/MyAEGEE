const { ValidationError } = require('sequelize');

const Integration = require('../../models/Integration');

describe('Integration model', () => {
    test('should validate a valid integration', async () => {
        const integration = Integration.build({
            name: 'Flixbus',
            code: 'flixbus',
            quota_period: 'month',
            quota_amount: 1,
            description: 'Ride cheaper across Europe'
        });

        await expect(integration.validate()).resolves.toBe(integration);
    });

    test('should fail if code is missing', async () => {
        const integration = Integration.build({
            name: 'Flixbus',
            code: null,
            quota_period: 'month',
            quota_amount: 1
        });

        await expect(integration.validate()).rejects.toBeInstanceOf(ValidationError);
    });

    test('should fail if quota_period is invalid', async () => {
        const integration = Integration.build({
            name: 'Flixbus',
            code: 'flixbus',
            quota_period: 'week',
            quota_amount: 1
        });

        await expect(integration.validate()).rejects.toBeInstanceOf(ValidationError);
    });

    test('should fail if quota_amount is less than one', async () => {
        const integration = Integration.build({
            name: 'Flixbus',
            code: 'flixbus',
            quota_period: 'month',
            quota_amount: 0
        });

        await expect(integration.validate()).rejects.toBeInstanceOf(ValidationError);
    });
});
