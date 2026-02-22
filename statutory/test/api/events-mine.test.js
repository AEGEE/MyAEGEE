const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;

describe('Events participating', () => {
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

    test('should not display events you haven\'t applied to', async () => {
        const event = await generator.createEvent({ status: 'published' });

        const res = await request({
            uri: '/mine',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        const ids = res.body.data.map((e) => e.id);
        expect(ids).not.toContain(event.id);
    });

    test('should display all published events you applied to', async () => {
        const event = await generator.createEvent({ status: 'published' });
        await generator.createApplication({ user_id: regularUser.id }, event);

        const res = await request({
            uri: '/mine',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        const ids = res.body.data.map((e) => e.id);
        expect(ids).toContain(event.id);
    });

    test('should hide application status on /mine until it is revealed', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            status: 'published',
            participants_list_publish_deadline: moment().add(1, 'day').toDate()
        });

        await generator.createApplication({
            user_id: regularUser.id,
            status: 'accepted'
        }, event);

        const hiddenRes = await request({
            uri: '/mine',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(hiddenRes.statusCode).toEqual(200);
        expect(hiddenRes.body.data[0].applications[0].status).toEqual('pending');

        await event.update({ application_status_revealed_at: new Date() });

        const revealedRes = await request({
            uri: '/mine',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(revealedRes.statusCode).toEqual(200);
        expect(revealedRes.body.data[0].applications[0].status).toEqual('accepted');
    });
});
