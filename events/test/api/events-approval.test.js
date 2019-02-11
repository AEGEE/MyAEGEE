const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Event } = require('../../models');

describe('Events approval', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();

        await generator.clearAll();
    });

    it('should include the event that can be changed in approvable events', async () => {
        const event = await generator.createEvent({
            status: 'draft'
        });

        const res = await request({
            uri: '/mine/approvable',
            headers: { 'X-Auth-Token': 'foobar' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(event.id);
    });

    it('should not include the event that cannot be changed in approvable events', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        await generator.createEvent({
            status: 'draft'
        });

        const res = await request({
            uri: '/mine/approvable',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'GET'
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.length).toEqual(0);
    });

    it('should perform status change when it\'s allowed', async () => {
        const event = await generator.createEvent({
            status: 'draft'
        });

        const res = await request({
            uri: '/single/' + event.id + '/status',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'PUT',
            body: { status: 'published' }
        });

        expect(res.statusCode).toEqual(200);

        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('message');

        const eventFromDb = await Event.findByPk(event.id);
        expect(eventFromDb.status).toEqual('published');
    });

    it('should not perform status change when the user is not allowed to do it', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });
        const event = await generator.createEvent({
            status: 'draft'
        });

        const res = await request({
            uri: '/single/' + event.id + '/status',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'PUT',
            body: { status: 'published' }
        });

        expect(res.statusCode).toEqual(403);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');

        const eventFromDb = await Event.findByPk(event.id);
        expect(eventFromDb.status).not.toEqual('published');
    });
});
