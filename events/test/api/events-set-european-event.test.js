const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const user = require('../assets/oms-core-valid.json').data;

describe('Events set European Event', () => {
    let event;

    beforeEach(async () => {
        event = await generator.createEvent({
            organizers: [
                { first_name: 'test', last_name: 'test', user_id: user.id },
            ],
        });
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();

        await generator.clearAll();
    });

    it('should fail setting European Event status if no permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const res = await request({
            path: '/single/' + event.id + '/status/european_event',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                is_european_event: true,
            },
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should return a validation error on malformed body for changing European Event status', async () => {
        const res = await request({
            path: '/single/' + event.id + '/status/european_event',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                is_european_event: 'blablabla',
            },
        });

        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('is_european_event');
    });

    it('should succeed changing European Event status on sane request', async () => {
        const res = await request({
            path: '/single/' + event.id + '/status/european_event',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                is_european_event: false,
            },
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.message).toEqual(
            'Successfully changed European Event status'
        );
    });

    it('should succeed changing European Event status back to true', async () => {
        const europeanEvent = await generator.createEvent({
            is_european_event: false,
        });

        const res = await request({
            path: '/single/' + europeanEvent.id + '/status/european_event',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                is_european_event: true,
            },
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.message).toEqual(
            'Successfully changed European Event status'
        );
    });
});
