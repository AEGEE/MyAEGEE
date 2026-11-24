const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;

// A route that saves something answers with what was stored, not with what was sent:
// a number sent as text comes back as a number.
describe('Answers hold the stored values', () => {
    let event;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll();

        event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate(),
            applications: []
        });
    });

    afterEach(async () => {
        await generator.clearAll();
        mock.cleanAll();
    });

    const send = (method, path, body) => request({
        path,
        method,
        headers: { 'X-Auth-Token': 'blablabla' },
        body
    });

    test('should answer with numbers when creating an event', async () => {
        const res = await send('POST', '/', generator.generateEvent({ type: 'epm', body_id: '34', fee: '12.50' }));

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.body_id).toStrictEqual(34);
        expect(Number(res.body.data.fee)).toEqual(12.5);
    });

    test('should answer with numbers when editing an event', async () => {
        const res = await send('PUT', '/events/' + event.id, { body_id: '34' });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.body_id).toStrictEqual(34);
    });

    test('should answer with numbers when creating a position', async () => {
        const res = await send('POST', '/events/' + event.id + '/positions', generator.generatePosition({ places: '5' }));

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.places).toStrictEqual(5);
    });

    test('should answer with numbers when editing a position', async () => {
        const position = await generator.createPosition({ places: 1 }, event);

        const res = await send('PUT', '/events/' + event.id + '/positions/' + position.id, { places: '5' });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.places).toStrictEqual(5);
    });

    test('should answer with the stored limit when changing a participants limit', async () => {
        await generator.createPaxLimit({ body_id: 34, event_type: 'agora', delegate: 1, envoy: 1, observer: 1, visitor: 1 });

        const res = await send('POST', '/limits/agora', { body_id: '34', delegate: 3, envoy: 0, observer: 0, visitor: null });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data).toMatchObject({ body_id: 34, delegate: 3, envoy: 0, observer: 0, visitor: null });
    });

    test('should answer with numbers when applying', async () => {
        const res = await send('POST', '/events/' + event.id + '/applications', generator.generateApplication({
            body_id: regularUser.bodies[0].id,
            number_of_events_visited: '3'
        }, event));

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.number_of_events_visited).toStrictEqual(3);
    });

    test('should answer with numbers when editing an application', async () => {
        const application = await generator.createApplication({ user_id: regularUser.id, body_id: regularUser.bodies[0].id }, event);

        const res = await send('PUT', '/events/' + event.id + '/applications/' + application.id, { number_of_events_visited: '3' });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.number_of_events_visited).toStrictEqual(3);
    });

    test('should answer with numbers when setting the participant order of an application', async () => {
        const application = await generator.createApplication({
            user_id: 1337,
            body_id: regularUser.bodies[0].id,
            participant_type: null,
            participant_order: null
        }, event);

        const res = await send('PUT', '/events/' + event.id + '/applications/' + application.id + '/board', {
            participant_type: 'visitor',
            participant_order: '2'
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.participant_order).toStrictEqual(2);
    });

    test('should answer with the stored amount when setting the paid fee of a memberslist', async () => {
        await generator.createMembersList({ body_id: regularUser.bodies[0].id }, event);

        const res = await send('PUT', '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id + '/fee_paid', { fee_paid: 300 });

        expect(res.statusCode).toEqual(200);
        expect(Number(res.body.data.fee_paid)).toEqual(300);
    });

    // A number for a text field answers 422 (see field-types); values that are converted are
    // answered as stored.
    test('should answer with the stored moments when a plenary gets times in another time zone', async () => {
        const plenary = await generator.createPlenary({}, event);

        const res = await send('PUT', '/events/' + event.id + '/plenaries/' + plenary.id, {
            starts: '2031-07-01T12:00:00+02:00',
            ends: '2031-07-01T14:00:00+02:00'
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.starts).toEqual('2031-07-01T10:00:00.000Z');
        expect(res.body.data.ends).toEqual('2031-07-01T12:00:00.000Z');
    });

    test('should answer with a number when a candidature gets its body as text', async () => {
        const position = await generator.createPosition({}, event);
        const candidate = await generator.createCandidate({ user_id: regularUser.id, body_id: regularUser.bodies[0].id }, position);

        const res = await send('PUT', '/events/' + event.id + '/positions/' + position.id + '/candidates/' + candidate.id, {
            body_id: String(regularUser.bodies[0].id)
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.body_id).toStrictEqual(regularUser.bodies[0].id);
    });
});
