const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Event, Position, Plenary } = require('../../models');

// An edit checks what it changes. The edit forms send the whole record back, so stored values
// that today's checks would refuse, and that the edit leaves as they are, do not stop the
// save. A changed date is checked against the stored dates of the record.
describe('Edits of records with stored values that today\'s checks refuse', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll();
    });

    afterEach(async () => {
        await generator.clearAll();
        mock.cleanAll();
    });

    const send = (method, path, body) => request({ path, method, headers: { 'X-Auth-Token': 'blablabla' }, body });

    // Stores values without the checks, as older versions of the service did.
    const storeAsIs = (model, record, values) => model.update(values, { where: { id: record.id }, validate: false, hooks: false });

    // What the edit form sends back: the record as the service gives it.
    const asTheFormSendsIt = async (path) => {
        const res = await send('GET', path);
        expect(res.statusCode).toEqual(200);
        return res.body.data;
    };

    describe('an event', () => {
        let event;

        beforeEach(async () => {
            event = await generator.createEvent({ type: 'epm', applications: [] });
            await storeAsIs(Event, event, {
                questions: [{ type: 'string', description: 'An old question' }],
                locations: [{ position: { lat: 1, lng: 2 } }],
                // A deadline after the end of the event, and the deadlines of an Agora not set.
                board_approve_deadline: moment(event.ends).add(1, 'day').toDate(),
                draft_proposal_deadline: null,
                final_proposal_deadline: null
            });
        });

        test('saved unchanged answers 200', async () => {
            const stored = await asTheFormSendsIt('/events/' + event.id);

            const res = await send('PUT', '/events/' + event.id, { ...stored, name: 'A new name' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.name).toEqual('A new name');
            expect((await Event.findByPk(event.id)).questions).toEqual([{ type: 'string', description: 'An old question' }]);
        });

        test.each([
            ['questions', [{ type: 'string', description: 'A changed question' }], 'Question 1: required is not a boolean.'],
            ['locations', [{ position: { lat: 3, lng: 4 } }], 'Name is invalid.']
        ])('a changed %s is checked', async (field, value, message) => {
            const stored = await asTheFormSendsIt('/events/' + event.id);

            const res = await send('PUT', '/events/' + event.id, { ...stored, [field]: value });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors[field]).toContain(message);
        });

        test('a changed date is checked against the stored dates', async () => {
            const stored = await asTheFormSendsIt('/events/' + event.id);

            const res = await send('PUT', '/events/' + event.id, { ...stored, application_period_ends: moment(event.ends).add(2, 'days').toDate() });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('application_period_ends');
        });
    });

    test('a position with an empty end of term saved unchanged answers 200, and a changed one is checked', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const position = await generator.createPosition({}, event);
        await storeAsIs(Position, position, { end_term: '' });
        const path = '/events/' + event.id + '/positions/' + position.id;
        const stored = (await asTheFormSendsIt('/events/' + event.id + '/positions/all')).find((item) => item.id === position.id);

        const unchanged = await send('PUT', path, { ...stored, name: 'A new name' });
        expect(unchanged.statusCode).toEqual(200);
        expect(unchanged.body.data.name).toEqual('A new name');

        const changed = await send('PUT', path, { ...stored, end_term: '', starts: moment(stored.ends).add(1, 'day').toDate() });
        expect(changed.statusCode).toEqual(422);
        expect(changed.body.errors).toHaveProperty('ends');
    });

    test('a plenary whose stored times contradict each other saved unchanged answers 200', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = await generator.createPlenary({}, event);
        await storeAsIs(Plenary, plenary, { ends: moment(plenary.starts).subtract(1, 'hour').toDate() });
        const path = '/events/' + event.id + '/plenaries/' + plenary.id;
        const stored = await asTheFormSendsIt(path);

        const unchanged = await send('PUT', path, { name: stored.name, starts: stored.starts, ends: stored.ends });
        expect(unchanged.statusCode).toEqual(200);

        const changed = await send('PUT', path, { name: stored.name, starts: moment(stored.starts).add(1, 'minute').toDate(), ends: stored.ends });
        expect(changed.statusCode).toEqual(422);
    });
});
