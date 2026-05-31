const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const user = require('../assets/oms-core-valid.json').data;

describe('Events future applications', () => {
    beforeEach(async () => {
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();
        await generator.clearAll();
    });

    it('should allow application ban managers to list future applications without event management permissions', async () => {
        mock.mockAll({ mainPermissions: { applicationBanPermission: true }, approvePermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            name: 'Future event',
            application_starts: moment().subtract(1, 'week').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            starts: moment().add(1, 'month').toDate(),
            ends: moment().add(1, 'month').add(1, 'day').toDate(),
            status: 'published',
            deleted: false
        });
        await generator.createApplication(event, {
            user_id: user.id,
            status: 'pending'
        });

        const res = await request({
            path: '/applications/future/' + user.id,
            headers: { 'X-Auth-Token': 'foobar' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0]).toMatchObject({
            service: 'events',
            event_id: event.id,
            event_name: 'Future event',
            application_status: 'pending'
        });
    });

    it('should reject users without application ban or event management permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true }, approvePermissions: { noPermissions: true } });

        const res = await request({
            path: '/applications/future/' + user.id,
            headers: { 'X-Auth-Token': 'foobar' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
    });
});
