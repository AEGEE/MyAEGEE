const generator = require('../scripts/generator');
const { Application, Event } = require('../../models');
const helpers = require('../../lib/helpers');

// Validation branches of the models that no request reaches.
describe('Model validation', () => {
    afterEach(async () => {
        await generator.clearAll();
    });

    test('should refuse an event URL that is not text', async () => {
        const event = Event.build(generator.generateEvent({ url: 123 }));

        await expect(event.validate()).rejects.toThrow('Event URL cannot contain numbers only.');
    });

    test('should refuse the answers of an application for an event that does not exist', async () => {
        const application = Application.build(generator.generateApplication({ event_id: 2147483647, answers: [] }));

        // Without the hooks: the one that checks the meals needs the event as well.
        await expect(application.validate({ hooks: false })).rejects.toThrow('Could not find event.');
    });

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

describe('helpers.shouldHideApplicationStatus', () => {
    const event = (deadline) => ({ participants_list_publish_deadline: deadline, application_status_revealed_at: null });
    const past = new Date(Date.now() - 60 * 1000);
    const future = new Date(Date.now() + 60 * 1000);

    test('should hide the status before the participants list deadline when no permissions are given', () => {
        expect(helpers.shouldHideApplicationStatus(event(future))).toEqual(true);
    });

    test('should show the status after the participants list deadline when no permissions are given', () => {
        expect(helpers.shouldHideApplicationStatus(event(past))).toEqual(false);
    });
});
