const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/oms-core-valid').data;

describe('Massmailer', () => {
    let event;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll();

        event = await generator.createEvent();
        await generator.createApplication({
            user_id: 1,
            body_id: regularUser.bodies[0].id,
            participant_type: 'envoy',
            participant_order: 1,
            status: 'accepted'
        }, event);
        await generator.createApplication({
            user_id: 2,
            body_id: regularUser.bodies[0].id,
            participant_type: 'envoy',
            participant_order: 2,
            status: 'rejected'
        }, event);
        await generator.createApplication({
            user_id: 3,
            body_id: regularUser.bodies[0].id,
            participant_type: 'envoy',
            participant_order: 3
        }, event);
        await generator.createApplication({
            user_id: 4,
            body_id: regularUser.bodies[0].id,
            participant_type: 'envoy',
            participant_order: 4,
            cancelled: true
        }, event);
    });

    afterEach(async () => {
        await generator.clearAll();
        mock.cleanAll();
    });

    test('should disallow using massmailer if no rights', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const res = await request({
            uri: '/events/' + event.id + '/massmailer',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                subject: 'Testing',
                text: 'Testing mail sending.'
            }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should send mass mail if everything is okay', async () => {
        const res = await request({
            uri: '/events/' + event.id + '/massmailer',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                subject: 'Testing',
                text: 'Testing mail sending.'
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('message');
        expect(res.body.meta.sent).toEqual(3);
    });

    test('should work okay if the pax type/order is not set', async () => {
        await generator.createApplication({
            user_id: 5,
            body_id: regularUser.bodies[0].id,
            participant_type: null,
            participant_order: null,
            status: 'accepted'
        }, event);

        const res = await request({
            uri: '/events/' + event.id + '/massmailer',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                subject: 'Testing',
                text: 'Testing mail sending.'
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('message');
        expect(res.body.meta.sent).toEqual(4);
    });

    test('should fail if body is not set', async () => {
        const res = await request({
            uri: '/events/' + event.id + '/massmailer',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                subject: 'Testing'
            }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if body is empty', async () => {
        const res = await request({
            uri: '/events/' + event.id + '/massmailer',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                text: '',
                subject: 'Testing'
            }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if subject is not set', async () => {
        const res = await request({
            uri: '/events/' + event.id + '/massmailer',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                text: 'Testing'
            }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if subject is empty', async () => {
        const res = await request({
            uri: '/events/' + event.id + '/massmailer',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                text: 'Text',
                subject: ''
            }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if oms-mailer returns net error', async () => {
        mock.mockAll({ mailer: { netError: true } });
        const res = await request({
            uri: '/events/' + event.id + '/massmailer',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                subject: 'Testing',
                text: 'Testing mail sending.'
            }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if oms-mailer returns bad response', async () => {
        mock.mockAll({ mailer: { badResponse: true } });
        const res = await request({
            uri: '/events/' + event.id + '/massmailer',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                subject: 'Testing',
                text: 'Testing mail sending.'
            }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if oms-mailer returns unsuccessful response', async () => {
        mock.mockAll({ mailer: { unsuccessfulResponse: true } });
        const res = await request({
            uri: '/events/' + event.id + '/massmailer',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                subject: 'Testing',
                text: 'Testing mail sending.'
            }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should work with filtering', async () => {
        const res = await request({
            uri: '/events/' + event.id + '/massmailer/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                subject: 'Testing',
                text: 'Testing mail sending.',
                filter: { status: 'accepted' }
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('message');
        expect(res.body.meta.sent).toEqual(1);
    });

    test('should fail if no users match the filter', async () => {
        const res = await request({
            uri: '/events/' + event.id + '/massmailer/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                subject: 'Testing',
                text: 'Testing mail sending.',
                filter: { status: 'accepted', paid_fee: true }
            }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });
});
