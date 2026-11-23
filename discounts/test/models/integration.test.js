const { ValidationError } = require('sequelize');

const { Integration } = require('../../models');

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

    test.each([
        ['name', 'Integration name should be at most 255 characters long.'],
        ['code', 'Integration code should be at most 255 characters long.']
    ])('should fail if %s is longer than 255 characters', async (field, message) => {
        const integration = Integration.build({ name: 'Partner', code: 'partner', quota_period: 'month', quota_amount: 1, [field]: 'a'.repeat(256) });

        await expect(integration.validate()).rejects.toThrow(message);
    });
});
