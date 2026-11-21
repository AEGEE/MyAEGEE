const { ValidationError } = require('sequelize');

const { Code } = require('../../models');

describe('Code model', () => {
    test('should validate a valid code', async () => {
        const code = Code.build({
            value: 'SAVE-123',
            integration_id: 1,
            claimed_by: 42
        });

        await expect(code.validate()).resolves.toBe(code);
    });

    test('should fail if value is missing', async () => {
        const code = Code.build({
            value: null,
            integration_id: 1
        });

        await expect(code.validate()).rejects.toBeInstanceOf(ValidationError);
    });

    test('should fail if integration_id is missing', async () => {
        const code = Code.build({
            value: 'SAVE-123',
            integration_id: null
        });

        await expect(code.validate()).rejects.toBeInstanceOf(ValidationError);
    });
});
