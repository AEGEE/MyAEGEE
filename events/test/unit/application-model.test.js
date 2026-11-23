const { Application } = require('../../models');

// Rules of the model that the routes do not reach (they check these first), tested on the
// model. Only the named fields are validated.
describe('Application model', () => {
    test.each(['confirmed', 'attended'])('should reject a %s value that is not a boolean', async (field) => {
        const application = Application.build({ [field]: 'yes' });

        await expect(application.validate({ fields: [field] })).rejects.toMatchObject({
            errors: expect.arrayContaining([expect.objectContaining({ path: field, message: 'The value should be true or false.' })])
        });
    });

    test('should reject answers for an event that does not exist', async () => {
        const application = Application.build({ event_id: 2147483647, answers: [] });

        await expect(application.validate({ fields: ['answers'] })).rejects.toMatchObject({
            errors: [expect.objectContaining({ path: 'answers', message: 'Could not find event.' })]
        });
    });

    test('should accept boolean flags', async () => {
        const application = Application.build({ confirmed: true, attended: true });

        await expect(application.validate({ fields: ['confirmed', 'attended'] })).resolves.toBeDefined();
    });
});
