const moment = require('moment');
const xlsx = require('node-xlsx');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Attendance } = require('../../models');

// Those who take part in the plenaries are the delegates and envoys whose application is
// accepted and not cancelled: only they can be marked, and only they are counted in the
// statistics of the bodies.
describe('Participants of the plenaries', () => {
    let event;
    let plenary;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll();
        event = await generator.createEvent({ type: 'agora', applications: [] });
        plenary = await generator.createPlenary({
            name: 'Opening',
            starts: moment().subtract(1, 'hour').toDate(),
            ends: moment().add(1, 'hour').toDate()
        }, event);
    });

    afterEach(async () => {
        mock.cleanAll();
        await generator.clearAll();
    });

    const mark = (application) => request({
        path: '/events/' + event.id + '/plenaries/' + plenary.id + '/attendance/mark',
        method: 'POST',
        headers: { 'X-Auth-Token': 'blablabla' },
        body: { application_id: application.id }
    });

    // A cancelled application cannot be confirmed: it is cancelled afterwards.
    const createDelegate = async ({ cancelled, ...fields }) => {
        const application = await generator.createApplication({ participant_type: 'delegate', participant_order: 1, ...fields }, event);
        if (cancelled) {
            await application.update({ cancelled: true });
        }

        return application;
    };

    test.each([
        ['pending', { status: 'pending' }],
        ['rejected', { status: 'rejected' }],
        ['on the waiting list', { status: 'waiting_list' }],
        ['accepted and cancelled', { status: 'accepted', cancelled: true }]
    ])('a delegate whose application is %s cannot be marked', async (description, fields) => {
        const application = await createDelegate(fields);

        const res = await mark(application);

        expect(res.statusCode).toEqual(403);
        expect(res.body).toEqual({ success: false, message: 'The application is not accepted, or it is cancelled.' });
        expect(await Attendance.count()).toEqual(0);
    });

    test('a delegate whose application is accepted can be marked', async () => {
        const application = await createDelegate({ status: 'accepted' });

        const res = await mark(application);

        expect(res.statusCode).toEqual(200);
        expect(await Attendance.count({ where: { application_id: application.id } })).toEqual(1);
    });

    test('the statistics count the delegates whose application is accepted and not cancelled', async () => {
        const accepted = await createDelegate({ status: 'accepted', body_id: 4242 });
        await createDelegate({ status: 'accepted', cancelled: true, participant_order: 2, body_id: 4242 });
        await createDelegate({ status: 'rejected', participant_order: 3, body_id: 4242 });

        const res = await request({
            path: '/events/' + event.id + '/plenaries/stats',
            method: 'GET',
            responseType: 'buffer',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        const [general] = xlsx.parse(res.body);
        expect(general.data.slice(1).map((row) => row[0])).toEqual([accepted.id]);
    });
});
