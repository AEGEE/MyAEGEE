const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');

describe('Events listing', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();

        await generator.clearAll();
    });

    it('should list all published on / GET', async () => {
        const event = await generator.createEvent({ status: 'published' });
        await generator.createEvent({ status: 'draft' });

        const res = await request({
            uri: '/',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.length).toEqual(1);

        expect(res.body.data[0]).toHaveProperty('id');
        expect(res.body.data[0]).toHaveProperty('name');
        expect(res.body.data[0]).toHaveProperty('starts');
        expect(res.body.data[0]).toHaveProperty('ends');
        expect(res.body.data[0]).toHaveProperty('application_status');
        expect(res.body.data[0]).toHaveProperty('status');
        expect(res.body.data[0]).toHaveProperty('type');
        expect(res.body.data[0]).toHaveProperty('description');

        expect(res.body.data[0].id).toEqual(event.id);
    });

    it('should use the default limit if limit is NaN', async () => {
        const res = await request({
            uri: '/?limit=nan',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.length).not.toEqual(1);
        expect(res.body.meta.limit).not.toEqual('nan');
        expect(res.body.meta.moreAvailable).toEqual(false);
    });

    it('should use the default limit if limit is < 0', async () => {
        await generator.createEvent({ status: 'published' });

        const res = await request({
            uri: '/?limit=-1',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.length).not.toEqual(-1);
        expect(res.body.meta.limit).not.toEqual(-1);
        expect(res.body.meta.moreAvailable).toEqual(false);
    });

    it('should work with limit if limit is > 0', async () => {
        await generator.createEvent({ status: 'published' });
        await generator.createEvent({ status: 'published' });

        const res = await request({
            uri: '/?limit=1',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.meta.limit).toEqual(1);
        expect(res.body.meta.moreAvailable).toEqual(true);
    });

    it('should use the default offset if offset is NaN', async () => {
        const res = await request({
            uri: '/?offset=nan',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.length).not.toEqual(1);
        expect(res.body.meta.offset).not.toEqual('nan');
        expect(res.body.meta.moreAvailable).toEqual(false);
    });

    it('should use the default offset if offset is < 0', async () => {
        const res = await request({
            uri: '/?offset=-1',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.length).not.toEqual(1);
        expect(res.body.meta.offset).not.toEqual(-1);
        expect(res.body.meta.moreAvailable).toEqual(false);
    });

    it('should work with offset if offset is > 0', async () => {
        await generator.createEvent({ status: 'published' });
        await generator.createEvent({ status: 'published' });

        const res = await request({
            uri: '/?offset=100',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);


        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');


        expect(res.body.data.length).toEqual(0);
        expect(res.body.meta.offset).toEqual(100);
        expect(res.body.meta.moreAvailable).toEqual(false);
    });

    it('should display only specified event types if specified and if multiple types are specified', async () => {
        await generator.createEvent({ status: 'published', type: 'ltc' });
        const event = await generator.createEvent({ status: 'published', type: 'es' });

        const res = await request({
            uri: '/?type[]=es',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(event.id);
    });

    it('should display only specified event types if specified and if single type is specified', async () => {
        await generator.createEvent({ status: 'published', type: 'ltc' });
        const event = await generator.createEvent({ status: 'published', type: 'es' });

        const res = await request({
            uri: '/?type=es',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(event.id);
    });

    it('should not display past events if displayPast=false', async () => {
        await generator.createEvent({
            status: 'published',
            application_starts: moment().subtract(5, 'week').toDate(),
            application_ends: moment().subtract(4, 'week').toDate(),
            starts: moment().subtract(3, 'week').toDate(),
            ends: moment().subtract(2, 'week').toDate(),
        });

        const res = await request({
            uri: '/?displayPast=false',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.length).toEqual(0);
    });

    it('should display past events if displayPast=true', async () => {
        await generator.createEvent({
            application_starts: moment().subtract(5, 'week').toDate(),
            application_ends: moment().subtract(4, 'week').toDate(),
            starts: moment().subtract(3, 'week').toDate(),
            ends: moment().subtract(2, 'week').toDate(),
            status: 'published'
        });

        const res = await request({
            uri: '/?displayPast=true',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.length).not.toEqual(0);
    });

    it('should filter by name case-insensitive', async () => {
        await generator.createEvent({
            status: 'published',
            name: 'NWM Voronezh'
        });

        const res = await request({
            uri: '/?search=nwm',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(1);

        expect(res.body.data[0].name.toLowerCase()).toContain('nwm');
    });

    it('should filter by description case-insensitive', async () => {
        await generator.createEvent({
            status: 'published',
            description: 'Drafting Action Agenda'
        });

        const res = await request({
            uri: '/?search=action agenda',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(1);

        expect(res.body.data[0].description.toLowerCase()).toContain('action agenda');
    });
});
