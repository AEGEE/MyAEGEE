const tk = require('timekeeper');
const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;

// Until the participants list deadline (or until the event reveals the statuses), every
// answer that gives the applicant their application gives the status "pending".
describe('Application status before it is revealed', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });
    });

    afterEach(async () => {
        tk.reset();
        await generator.clearAll();
        mock.cleanAll();
    });

    const duringApplicationPeriod = (event) => tk.freeze(moment(event.application_period_starts).add(5, 'minutes').toDate());

    test.each(['accepted', 'rejected', 'waiting_list'])('cancelling an application that is %s answers "pending"', async (status) => {
        const event = await generator.createEvent();
        await generator.createApplication({ user_id: regularUser.id, status }, event);

        duringApplicationPeriod(event);

        const res = await request({
            path: '/events/' + event.id + '/applications/me/cancel',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { cancelled: true }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.cancelled).toEqual(true);
        expect(res.body.data.status).toEqual('pending');
    });

    test.each(['rejected', 'waiting_list'])('editing an application that is %s answers "pending"', async (status) => {
        const event = await generator.createEvent();
        await generator.createApplication({ user_id: regularUser.id, status }, event);

        duringApplicationPeriod(event);

        const res = await request({
            path: '/events/' + event.id + '/applications/me',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { body_id: regularUser.bodies[0].id }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.body_id).toEqual(regularUser.bodies[0].id);
        expect(res.body.data.status).toEqual('pending');
    });

    test('cancelling answers the status once the event revealed it', async () => {
        const event = await generator.createEvent({ application_status_revealed_at: new Date() });
        await generator.createApplication({ user_id: regularUser.id, status: 'accepted' }, event);

        duringApplicationPeriod(event);

        const res = await request({
            path: '/events/' + event.id + '/applications/me/cancel',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { cancelled: true }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.status).toEqual('accepted');
    });

    test('those who manage applications get the status when they cancel', async () => {
        mock.mockAll({ mainPermissions: { permissions: ['global:manage_applications:agora'] } });

        const event = await generator.createEvent({ type: 'agora' });
        const application = await generator.createApplication({ user_id: 2, status: 'accepted' }, event);

        duringApplicationPeriod(event);

        const res = await request({
            path: '/events/' + event.id + '/applications/' + application.id + '/cancel',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { cancelled: true }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.status).toEqual('accepted');
    });
});
