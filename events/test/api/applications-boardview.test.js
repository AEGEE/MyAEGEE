const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const user = require('../assets/oms-core-valid.json').data;

describe('Events application boardview', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();

        await generator.clearAll();
    });

    it('should return an error if you are not a boardmember of this body', async () => {
        const res = await request({
            uri: '/boardview/1337',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'GET'
        });

        expect(res.statusCode).toEqual(403);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should return an error if bodyId is not a number', async () => {
        const res = await request({
            uri: '/boardview/nan',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'GET'
        });

        expect(res.statusCode).toEqual(400);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should display the application of the current body', async () => {
        const body = user.bodies.find((b) => user.circles.some((c) => c.body_id === b.id && c.name.toLowerCase().includes('board')));
        const event = await generator.createEvent();
        const application = await generator.createApplication({ body_id: body.id }, event);

        const res = await request({
            uri: '/boardview/' + body.id,
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'GET'
        });

        expect(res.statusCode).toEqual(200);

        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(application.id);
    });

    it('should not display the application of other bodies', async () => {
        const body = user.bodies.find((b) => user.circles.some((c) => c.body_id === b.id && c.name.toLowerCase().includes('board')));
        const event = await generator.createEvent({});
        await generator.createApplication({ body_id: 1337 }, event);

        const res = await request({
            uri: '/boardview/' + body.id,
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'GET'
        });

        expect(res.statusCode).toEqual(200);

        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.length).toEqual(0);
    });
});
