const tk = require('timekeeper');

const generator = require('../scripts/generator');
const { Plenary, Attendance } = require('../../models');
const { Sequelize } = require('../../lib/sequelize');

// The validation messages of an instance, per field; an empty object when it is valid.
const errorsOf = async (instance) => {
    try {
        await instance.validate();
        return {};
    } catch (err) {
        return err.errors.reduce((acc, error) => {
            acc[error.path] = [...(acc[error.path] || []), error.message];
            return acc;
        }, {});
    }
};

const STARTS = new Date('2030-03-01T10:00:00.000Z');
const ENDS = new Date('2030-03-01T12:00:00.000Z');

// The rules of the models that no request reaches: the routes fill in the event, the plenary,
// the application and the times of an attendance themselves.
describe('Plenary model', () => {
    afterEach(async () => {
        tk.reset();
        await generator.clearAll();
    });

    test('should define name as a string, like the database column', () => {
        expect(Plenary.rawAttributes.name.type).toBeInstanceOf(Sequelize.STRING);
    });

    test('refuses a plenary without an event', async () => {
        const plenary = Plenary.build({ name: 'Opening plenary', starts: STARTS, ends: ENDS });

        expect(await errorsOf(plenary)).toEqual({
            event_id: ['Event should be set.', 'Event ID should be a number.']
        });
    });

    test('refuses an event that is not a number', async () => {
        const plenary = Plenary.build({ event_id: 'abc', name: 'Opening plenary', starts: STARTS, ends: ENDS });

        expect((await errorsOf(plenary)).event_id).toContain('Event ID should be a number.');
    });

    test('refuses a plenary without a start and an end', async () => {
        const plenary = Plenary.build({ event_id: 1, name: 'Opening plenary' });

        expect(await errorsOf(plenary)).toEqual({
            starts: ['Plenary start date should be set.', 'Plenary start date should be valid.'],
            ends: ['Plenary end date should be set.', 'Plenary end date should be valid.']
        });
    });

    // BUG: the column does not accept null and the model does (its validation of the name is
    // skipped for null), so a name of null reaches the database and comes back as a 500.
    // Expected: 'Plenary name should be set.'
    test('accepts a name of null', async () => {
        const plenary = Plenary.build({ event_id: 1, name: null, starts: STARTS, ends: ENDS });

        expect(await errorsOf(plenary)).toEqual({});
    });

    test('gives the duration in seconds, the milliseconds as a fraction', () => {
        expect(Plenary.build({ starts: STARTS, ends: ENDS }).duration).toEqual(7200);
        expect(Plenary.build({ starts: STARTS, ends: new Date('2030-03-01T10:00:01.500Z') }).duration).toEqual(1.5);
    });

    test('closes the attendances that are still open, of this plenary only', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const application = await generator.createApplication({ participant_type: 'delegate', participant_order: 1 }, event);
        const plenary = await generator.createPlenary({ starts: STARTS, ends: ENDS }, event);
        const otherPlenary = await generator.createPlenary({ starts: STARTS, ends: ENDS }, event);

        const left = await generator.createAttendance({
            application_id: application.id,
            starts: new Date('2030-03-01T10:05:00.000Z'),
            ends: new Date('2030-03-01T10:45:00.000Z')
        }, plenary);
        const stillIn = await generator.createAttendance({
            application_id: application.id,
            starts: new Date('2030-03-01T11:00:00.000Z'),
            ends: null
        }, plenary);
        const elsewhere = await generator.createAttendance({
            application_id: application.id,
            starts: new Date('2030-03-01T11:00:00.000Z'),
            ends: null
        }, otherPlenary);

        tk.freeze(ENDS);
        await plenary.closeAttendances();

        expect((await Attendance.findByPk(stillIn.id)).ends.toISOString()).toEqual('2030-03-01T12:00:00.000Z');
        expect((await Attendance.findByPk(left.id)).ends.toISOString()).toEqual('2030-03-01T10:45:00.000Z');
        expect((await Attendance.findByPk(elsewhere.id)).ends).toEqual(null);
    });
});

describe('Attendance model', () => {
    test('refuses an attendance without a plenary, an application and a start', async () => {
        expect(await errorsOf(Attendance.build({}))).toEqual({
            plenary_id: ['Plenary should be set.', 'Plenary ID should be a number.'],
            application_id: ['Application should be set.', 'Application ID should be a number.'],
            starts: ['Attendance start date should be set.', 'Attendance start date should be valid.']
        });
    });

    test('refuses a plenary and an application that are not numbers', async () => {
        const errors = await errorsOf(Attendance.build({ plenary_id: 'abc', application_id: 'abc', starts: STARTS }));

        expect(errors.plenary_id).toContain('Plenary ID should be a number.');
        expect(errors.application_id).toContain('Application ID should be a number.');
    });

    test('refuses a start and an end that are not dates', async () => {
        const attendance = Attendance.build({ plenary_id: 1, application_id: 1, starts: 'not-a-date', ends: 'not-a-date' });

        expect(await errorsOf(attendance)).toEqual({
            starts: ['Attendance start date should be valid.'],
            ends: ['Attendance end date should be valid.']
        });
    });

    test('refuses an empty end', async () => {
        const attendance = Attendance.build({ plenary_id: 1, application_id: 1, starts: STARTS, ends: '' });

        expect(await errorsOf(attendance)).toEqual({
            ends: ['Attendance end date should be set.', 'Attendance end date should be valid.']
        });
    });

    test.each([
        ['no end', {}],
        ['an end of null', { ends: null }]
    ])('accepts an attendance with %s: the member is still in', async (description, ends) => {
        const attendance = Attendance.build({ plenary_id: 1, application_id: 1, starts: STARTS, ...ends });

        expect(await errorsOf(attendance)).toEqual({});
    });

    test('accepts an end 1 ms after the start', async () => {
        const attendance = Attendance.build({
            plenary_id: 1, application_id: 1, starts: STARTS, ends: new Date('2030-03-01T10:00:00.001Z')
        });

        expect(await errorsOf(attendance)).toEqual({});
    });

    test.each([
        ['at the moment of the start', STARTS],
        ['1 ms before the start', new Date('2030-03-01T09:59:59.999Z')]
    ])('refuses an end %s', async (description, ends) => {
        const attendance = Attendance.build({ plenary_id: 1, application_id: 1, starts: STARTS, ends });

        // The message names an event: it was copied from the events.
        expect(await errorsOf(attendance)).toEqual({
            ends: ['Event cannot start after or at the same time it ends.']
        });
    });
});
