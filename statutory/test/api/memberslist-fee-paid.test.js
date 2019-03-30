const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/oms-core-valid').data;

describe('Memberslist fee_paid editing', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        await generator.clearAll();
        mock.cleanAll();
    });

    test('should fail if user has no permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        await generator.createMembersList({ body_id: regularUser.bodies[0].id }, event);
        const res = await request({
            uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id + '/fee_paid',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { fee_paid: 300 }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should succeed if user has permissions', async () => {
        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        await generator.createMembersList({ body_id: regularUser.bodies[0].id }, event);
        const res = await request({
            uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id + '/fee_paid',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { fee_paid: 300 }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.fee_paid).toEqual(300);
    });

    test('should return 404 if the memberslist is not found', async () => {
        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        const res = await request({
            uri: '/events/' + event.id + '/memberslists/1337/fee_paid',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { fee_paid: 300 }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 400 if body_id is NaN', async () => {
        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        const res = await request({
            uri: '/events/' + event.id + '/memberslists/false/fee_paid',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { fee_paid: 300 }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });
});
