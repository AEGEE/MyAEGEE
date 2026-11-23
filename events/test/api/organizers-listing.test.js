const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const user = require('../assets/oms-core-valid.json').data;

describe('Event organizing listing', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();

        await generator.clearAll();
    });

    it('should not list deleted events on /mine/organizing GET', async () => {
        await generator.createEvent({ deleted: true, organizers: [{ user_id: user.id, first_name: 'test', last_name: 'test' }] });

        const res = await request({ path: '/mine/organizing', headers: { 'X-Auth-Token': 'foobar' } });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data).toEqual([]);
    });

    it('should filter by type on /mine/organizing GET', async () => {
        const organizers = [{ user_id: user.id, first_name: 'test', last_name: 'test' }];
        const nwm = await generator.createEvent({ type: 'nwm', organizers });
        await generator.createEvent({ type: 'training', organizers });

        const res = await request({ path: '/mine/organizing', query: { type: 'nwm' }, headers: { 'X-Auth-Token': 'foobar' } });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.map((e) => e.id)).toEqual([nwm.id]);
        // Organizers see every field of their events, drafts included.
        expect(res.body.data[0]).toHaveProperty('budget');
        expect(res.body.data[0].status).toEqual('draft');
    });

    it('should list events where the user is organizer on /mine/organizing GET', async () => {
        const event = await generator.createEvent({ organizers: [{ first_name: 'test', last_name: 'test', user_id: user.id }] });
        const res = await request({
            path: '/mine/organizing',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        expect(res.body.success).toEqual(true);
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(event.id);
    });

    it('should not include events where the user is not organizer on /mine/organizing GET', async () => {
        await generator.createEvent({ organizers: [{ first_name: 'test', last_name: 'test', user_id: 1337 }] });
        const res = await request({
            path: '/mine/organizing',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        expect(res.body.success).toEqual(true);
        expect(res.body.data.length).toEqual(0);
    });
});
