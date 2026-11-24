const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Event } = require('../../models');

// A Summer University that has started or ended is saved by the forms as before: they send the
// stored dates back (the edit forms) or a new application period (the period modal), and the
// checks that all dates are in order, which run when one of them changes, accept what they send.
// Each form's own payload, in each publication state.
describe('Started and ended Summer Universities', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(() => {
        mock.mockAll();
    });

    afterEach(async () => {
        mock.cleanAll();
        await generator.clearAll();
    });

    const call = (method, path, body) => request({ path, method, headers: { 'X-Auth-Token': 'foobar' }, body });

    // What the first edit form (Edit.vue) sends: the event as loaded, with the bodies and the
    // organizers by id.
    const editPayload = (loaded) => {
        const form = JSON.parse(JSON.stringify(loaded));
        form.organizing_bodies = form.organizing_bodies.map((body) => ({ body_id: body.body_id }));
        form.organizers = form.organizers.map((organizer) => ({ user_id: organizer.user_id, role: organizer.role }));
        if (form.cooperation && form.cooperation.length !== 0) {
            form.cooperation = form.cooperation.map((body) => ({ body_id: body.body_id }));
        }
        return form;
    };

    // What the second edit form (EditSecond.vue) sends: the event as loaded, with the organizers
    // by id.
    const editSecondPayload = (loaded) => {
        const form = JSON.parse(JSON.stringify(loaded));
        form.organizers = form.organizers.map((organizer) => ({ user_id: organizer.user_id, role: organizer.role }));
        return form;
    };

    const STATES = [
        ['not published', 'first draft', 'none'],
        ['minimally published', 'first approval', 'minimal'],
        ['fully published', 'second approval', 'full']
    ];
    const TIMES = [
        ['started yesterday', -1, 5],
        ['ended yesterday', -11, -1]
    ];
    const rows = STATES.flatMap(([state, status, published]) => TIMES.map(([time, startsIn, endsIn]) => [`${state} and ${time}`, status, published, startsIn, endsIn]));

    const createPast = (status, published, startsIn, endsIn) => generator.createEvent({
        status,
        published,
        application_starts: generator.daysFromNow(startsIn - 40),
        application_ends: generator.daysFromNow(startsIn - 20),
        starts: generator.daysFromNow(startsIn),
        ends: generator.daysFromNow(endsIn)
    });

    test.each(rows)('the first edit form saves a Summer University %s', async (_name, status, published, startsIn, endsIn) => {
        const event = await createPast(status, published, startsIn, endsIn);
        const loaded = await call('GET', `/single/${event.id}`);

        const res = await call('PUT', `/single/${event.id}`, { ...editPayload(loaded.body.data), description: 'Changed after the start' });

        expect(res.statusCode).toEqual(200);
        expect((await Event.findByPk(event.id)).description).toEqual('Changed after the start');
    });

    test.each(rows)('the second edit form saves a Summer University %s', async (_name, status, published, startsIn, endsIn) => {
        const event = await createPast(status, published, startsIn, endsIn);
        const loaded = await call('GET', `/single/${event.id}`);

        const res = await call('PUT', `/single/${event.id}`, { ...editSecondPayload(loaded.body.data), description: 'Changed after the start' });

        expect(res.statusCode).toEqual(200);
        expect((await Event.findByPk(event.id)).description).toEqual('Changed after the start');
    });

    // The modal fills in the stored period; only a fully published Summer University has one to
    // change. A period that ends before the start is taken; one that ends after it is not.
    test.each(TIMES)('the application period modal saves the stored period of a Summer University %s', async (_name, startsIn, endsIn) => {
        const event = await createPast('second approval', 'full', startsIn, endsIn);

        const res = await call('PUT', `/single/${event.id}/application_period`, {
            application_starts: event.application_starts.toISOString(),
            application_ends: event.application_ends.toISOString()
        });

        expect(res.statusCode).toEqual(200);
    });

    test.each(TIMES)('the application period modal cannot end the period after the start of a Summer University %s', async (_name, startsIn, endsIn) => {
        const event = await createPast('second approval', 'full', startsIn, endsIn);

        const res = await call('PUT', `/single/${event.id}/application_period`, { application_ends: generator.daysFromNow(3).toISOString() });

        expect(res.statusCode).toEqual(422);
        expect(res.body.errors).toHaveProperty('application_ends');
    });
});
