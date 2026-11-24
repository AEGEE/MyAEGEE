const { Application } = require('../../models');
const generator = require('../scripts/generator');

describe('Application model', () => {
    test('should not validate answers for an event that does not exist', async () => {
        const application = Application.build(generator.generateApplication(null, { event_id: 2147483647, answers: [] }));

        await expect(application.validate()).rejects.toThrow('Could not find event.');
    });
});
