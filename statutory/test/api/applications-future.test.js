const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const user = require('../assets/core-valid.json').data;

describe('Statutory future applications', () => {
    beforeEach(async () => {
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();
        await generator.clearAll();
    });

    test('should allow application ban managers to list future applications without statutory management permissions', async () => {
        mock.mockAll({ mainPermissions: { applicationBanPermission: true }, approvePermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            name: 'Future statutory event',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate(),
            board_approve_deadline: moment().add(2, 'weeks').toDate(),
            participants_list_publish_deadline: moment().add(3, 'weeks').toDate(),
            memberslist_submission_deadline: moment().add(4, 'weeks').toDate(),
            starts: moment().add(1, 'month').toDate(),
            ends: moment().add(1, 'month').add(1, 'day').toDate(),
            status: 'published',
            applications: []
        });
        await generator.createApplication({
            user_id: user.id,
            status: 'pending',
            cancelled: false
        }, event);

        const res = await request({
            path: '/applications/future/' + user.id,
            headers: { 'X-Auth-Token': 'foobar' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0]).toMatchObject({
            service: 'statutory',
            event_id: event.id,
            event_name: 'Future statutory event',
            application_status: 'pending'
        });
    });

    test('should reject users without application ban or statutory management permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true }, approvePermissions: { noPermissions: true } });

        const res = await request({
            path: '/applications/future/' + user.id,
            headers: { 'X-Auth-Token': 'foobar' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
    });
});
