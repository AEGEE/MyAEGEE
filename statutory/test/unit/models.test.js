const generator = require('../scripts/generator');
const { Application, Event } = require('../../models');

// Validation branches of the models that no request reaches.
describe('Model validation', () => {
    afterEach(async () => {
        await generator.clearAll();
    });

    test('should refuse the answers of an application for an event that does not exist', async () => {
        const application = Application.build(generator.generateApplication({ event_id: 2147483647, answers: [] }));

        // Without the hooks: the one that checks the meals needs the event as well.
        await expect(application.validate({ hooks: false })).rejects.toThrow('Could not find event.');
    });

    // A defensive case: only an event stored before the validation of the question types
    // existed can hold a question of an unknown type, so no request of today reaches it.
    test('should refuse an answer to a question of a type that does not exist', async () => {
        const event = await generator.createEvent({ applications: [] });
        // An event with such a question cannot be saved through its own validation.
        await Event.update(
            { questions: [{ type: 'rating', description: 'How was it?', required: true }] },
            { where: { id: event.id }, validate: false, hooks: false }
        );

        const application = Application.build(generator.generateApplication({ answers: ['5'] }, event));

        await expect(application.validate()).rejects.toThrow('unknown question type: rating');
    });
});
