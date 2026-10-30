const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;

const bodyId = regularUser.bodies[0].id;

describe('Plenaries attendance per Local', () => {
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
        mock.cleanAll();
        await generator.clearAll();
    });

    const getAttendance = (event) => request({
        path: '/events/' + event.id + '/plenaries/local-attendance',
        method: 'GET',
        headers: { 'X-Auth-Token': 'blablabla' }
    });

    // A plenary of one hour that is over: week 1 is 9 weeks ago, week 2 is 8 weeks ago, and so on.
    const createHourPlenary = (event, name, week) => generator.createPlenary({
        name,
        starts: moment().subtract(10 - week, 'week').toDate(),
        ends: moment().subtract(10 - week, 'week').add(1, 'hour').toDate()
    }, event);

    test('should return 403 if no permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });
        const event = await generator.createEvent({ type: 'agora', applications: [] });

        const res = await getAttendance(event);

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return the threshold and 0% for a Local without delegates', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = await createHourPlenary(event, 'Test plenary', 1);

        const res = await getAttendance(event);

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.threshold).toEqual(80);
        expect(res.body.data.locals).toEqual([{
            body_id: bodyId,
            code: regularUser.bodies[0].code,
            name: regularUser.bodies[0].name,
            delegates: 0,
            plenaries: [{ plenary_id: plenary.id, seconds: 0, percent: 0 }],
            average_percent: 0,
            below_threshold: true
        }]);
    });

    test('should give 100% to a Local when one delegate is there and the other is not', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = await createHourPlenary(event, 'Test plenary', 1);

        // Anna is in the hall for the full plenary, Bram is in a workshop.
        const anna = await generator.createApplication({
            participant_type: 'delegate', participant_order: 1, user_id: regularUser.id, body_id: bodyId
        }, event);
        await generator.createApplication({
            participant_type: 'delegate', participant_order: 2, user_id: 1337, body_id: bodyId
        }, event);
        await generator.createAttendance({
            application_id: anna.id,
            starts: moment(plenary.starts).subtract(1, 'minute').toDate(),
            ends: moment(plenary.ends).add(1, 'minute').toDate()
        }, plenary);

        const res = await getAttendance(event);

        expect(res.statusCode).toEqual(200);
        const [local] = res.body.data.locals;
        expect(local.delegates).toEqual(2);
        expect(local.plenaries).toEqual([{ plenary_id: plenary.id, seconds: 3600, percent: 100 }]);
        expect(local.average_percent).toEqual(100);
        expect(local.below_threshold).toEqual(false);
    });

    test('should count overlapping visits of delegates once and an open visit until the end of the plenary', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = await createHourPlenary(event, 'Test plenary', 1);

        const first = await generator.createApplication({
            participant_type: 'delegate', participant_order: 1, user_id: regularUser.id, body_id: bodyId
        }, event);
        const second = await generator.createApplication({
            participant_type: 'delegate', participant_order: 2, user_id: 1337, body_id: bodyId
        }, event);

        // Minutes 0-30 and 20-40 together cover 40 minutes, the open visit from minute 50 adds the last 10 minutes.
        await generator.createAttendance({
            application_id: first.id,
            starts: plenary.starts,
            ends: moment(plenary.starts).add(30, 'minute').toDate()
        }, plenary);
        await generator.createAttendance({
            application_id: second.id,
            starts: moment(plenary.starts).add(20, 'minute').toDate(),
            ends: moment(plenary.starts).add(40, 'minute').toDate()
        }, plenary);
        await generator.createAttendance({
            application_id: second.id,
            starts: moment(plenary.starts).add(50, 'minute').toDate(),
            ends: null
        }, plenary);

        const res = await getAttendance(event);

        const [local] = res.body.data.locals;
        expect(local.plenaries[0].seconds).toEqual(3000);
        expect(local.average_percent).toBeCloseTo(83.3333, 3);
        expect(local.below_threshold).toEqual(false);
    });

    test('should not judge a plenary that did not start yet', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const past = await createHourPlenary(event, 'Past', 1);
        await generator.createPlenary({
            name: 'Future',
            starts: moment().add(1, 'week').toDate(),
            ends: moment().add(1, 'week').add(1, 'hour').toDate()
        }, event);

        const delegate = await generator.createApplication({
            participant_type: 'delegate', participant_order: 1, user_id: regularUser.id, body_id: bodyId
        }, event);
        await generator.createAttendance({ application_id: delegate.id, starts: past.starts, ends: past.ends }, past);

        const res = await getAttendance(event);

        const [local] = res.body.data.locals;
        expect(local.plenaries).toEqual([{ plenary_id: past.id, seconds: 3600, percent: 100 }]);
        expect(local.average_percent).toEqual(100);
        expect(local.below_threshold).toEqual(false);
    });

    test('should average the plenaries with the same weight each', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const first = await createHourPlenary(event, 'First', 1);
        const second = await createHourPlenary(event, 'Second', 2);
        await createHourPlenary(event, 'Third', 3);

        const delegate = await generator.createApplication({
            participant_type: 'delegate', participant_order: 1, user_id: regularUser.id, body_id: bodyId
        }, event);
        await generator.createAttendance({ application_id: delegate.id, starts: first.starts, ends: first.ends }, first);
        await generator.createAttendance({ application_id: delegate.id, starts: second.starts, ends: second.ends }, second);

        const res = await getAttendance(event);

        const [local] = res.body.data.locals;
        expect(local.plenaries.map((entry) => entry.percent)).toEqual([100, 100, 0]);
        expect(local.average_percent).toBeCloseTo(66.6667, 3);
        expect(local.below_threshold).toEqual(true);
    });

    test('should list only Antennae and not count envoys', async () => {
        mock.cleanAll();
        mock.mockAll({
            bodies: {
                list: [
                    { id: 34, code: 'ALC', name: 'AEGEE-Alicante', type: 'antenna' },
                    { id: 35, code: 'BCN', name: 'AEGEE-Barcelona', type: 'contact antenna' },
                    { id: 9, code: 'CT', name: 'Chair Team', type: 'commission' }
                ]
            }
        });
        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = await createHourPlenary(event, 'Test plenary', 1);
        const envoy = await generator.createApplication({
            participant_type: 'envoy', participant_order: 1, user_id: 1337, body_id: 35
        }, event);
        await generator.createAttendance({ application_id: envoy.id, starts: plenary.starts, ends: plenary.ends }, plenary);

        const res = await getAttendance(event);

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.locals.map((local) => local.body_id)).toEqual([34]);
    });

    test('should return an empty list for an event without plenaries', async () => {
        const event = await generator.createEvent({ type: 'agora', applications: [] });

        const res = await getAttendance(event);

        expect(res.statusCode).toEqual(200);
        const [local] = res.body.data.locals;
        expect(local.plenaries).toEqual([]);
        expect(local.below_threshold).toEqual(false);
    });
});
