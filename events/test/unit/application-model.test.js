const { Application } = require('../../models');

// The routes check these flags before they reach the model, so the model's own rules are
// tested here. Only the named fields are validated, so no database is needed.
describe('Application model', () => {
    test.each(['confirmed', 'attended'])('should reject a %s value that is not a boolean', async (field) => {
        const application = Application.build({ [field]: 'yes' });

        await expect(application.validate({ fields: [field] })).rejects.toMatchObject({
            errors: expect.arrayContaining([expect.objectContaining({ path: field, message: 'The value should be true or false.' })])
        });
    });

    test('should accept boolean flags', async () => {
        const application = Application.build({ confirmed: true, attended: true });

        await expect(application.validate({ fields: ['confirmed', 'attended'] })).resolves.toBeDefined();
    });
});
