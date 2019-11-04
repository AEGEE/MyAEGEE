const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');

describe('Events listing', () => {
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

    test('should work without authorization', async () => {
        mock.mockAll({
            core: { unauthorized: true },
            mainPermissions: { unauthorized: true },
            approvePermissions: { unauthorized: true },
        });

        const event = await generator.createEvent({ status: 'published' });

        const res = await request({
            uri: '/',
            method: 'GET'
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        const ids = res.body.data.map(e => e.id);
        expect(ids).toContain(event.id);
    });

    test('should display published event', async () => {
        const event = await generator.createEvent({ status: 'published' });

        const res = await request({
            uri: '/',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        const ids = res.body.data.map(e => e.id);
        expect(ids).toContain(event.id);
    });

    test('should not display draft event', async () => {
        const event = await generator.createEvent({ status: 'draft' });

        const res = await request({
            uri: '/',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        const ids = res.body.data.map(e => e.id);
        expect(ids).not.toContain(event.id);
    });

    test('should sort events descending', async () => {
        const first = await generator.createEvent({
            status: 'published',
            application_period_starts: moment().add(1, 'week').toDate(),
            application_period_ends: moment().add(2, 'week').toDate(),
            board_approve_deadline: moment().add(3, 'week').toDate(),
            participants_list_publish_deadline: moment().add(4, 'week').toDate(),
            memberslist_submission_deadline: moment().add(5, 'week').toDate(),
            starts: moment().add(6, 'week').toDate(),
            ends: moment().add(7, 'week').toDate(),
        });

        const second = await generator.createEvent({
            status: 'published',
            application_period_starts: moment().add(8, 'week').toDate(),
            application_period_ends: moment().add(9, 'week').toDate(),
            board_approve_deadline: moment().add(10, 'week').toDate(),
            participants_list_publish_deadline: moment().add(11, 'week').toDate(),
            memberslist_submission_deadline: moment().add(12, 'week').toDate(),
            starts: moment().add(13, 'week').toDate(),
            ends: moment().add(14, 'week').toDate(),
        });

        const res = await request({
            uri: '/',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.length).toEqual(2);
        expect(res.body.data[0].id).toEqual(second.id);
        expect(res.body.data[1].id).toEqual(first.id);
    });
});
