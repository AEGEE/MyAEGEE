const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');

describe('Events listing for single', () => {
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

    test('should return 404 if the event is not found', async () => {
        const res = await request({
            uri: '/events/nonexistant',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should work for unauthorized user', async () => {
        mock.mockAll({
            core: { unauthorized: true },
            mainPermissions: { unauthorized: true },
            approvePermissions: { unauthorized: true },
        });

        const event = await generator.createEvent();

        const res = await request({
            uri: '/events/' + event.id,
            method: 'GET'
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.name).toEqual(event.name);
    });

    test('should find event by url', async () => {
        const event = await generator.createEvent({ url: 'test-slug' });
        const res = await request({
            uri: '/events/test-slug',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.name).toEqual(event.name);
    });

    test('should find event by ID', async () => {
        const event = await generator.createEvent();
        const res = await request({
            uri: '/events/' + event.id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.name).toEqual(event.name);
    });

    test('should find latest event', async () => {
        await generator.createEvent({
            application_period_starts: moment().subtract(14, 'days'),
            application_period_ends: moment().subtract(13, 'days'),
            board_approve_deadline: moment().subtract(12, 'days'),
            participants_list_publish_deadline: moment().subtract(11, 'days'),
            memberslist_submission_deadline: moment().subtract(10, 'days'),
            starts: moment().subtract(9, 'days'),
            ends: moment().subtract(8, 'days'),
            status: 'published'
        });

        const secondEvent = await generator.createEvent({
            application_period_starts: moment().subtract(7, 'days'),
            application_period_ends: moment().subtract(6, 'days'),
            board_approve_deadline: moment().subtract(5, 'days'),
            participants_list_publish_deadline: moment().subtract(4, 'days'),
            memberslist_submission_deadline: moment().subtract(3, 'days'),
            starts: moment().subtract(2, 'days'),
            ends: moment().subtract(1, 'days'),
            status: 'published'
        });

        const res = await request({
            uri: '/events/latest',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.name).toEqual(secondEvent.name);
        expect(res.body.data.id).toEqual(secondEvent.id);
    });

    test('should find latest Agora', async () => {
        await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(14, 'days'),
            application_period_ends: moment().subtract(13, 'days'),
            board_approve_deadline: moment().subtract(12, 'days'),
            participants_list_publish_deadline: moment().subtract(11, 'days'),
            memberslist_submission_deadline: moment().subtract(10, 'days'),
            starts: moment().subtract(9, 'days'),
            ends: moment().subtract(8, 'days'),
            status: 'published'
        });

        const secondEvent = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(7, 'days'),
            application_period_ends: moment().subtract(6, 'days'),
            board_approve_deadline: moment().subtract(5, 'days'),
            participants_list_publish_deadline: moment().subtract(4, 'days'),
            memberslist_submission_deadline: moment().subtract(3, 'days'),
            starts: moment().subtract(2, 'days'),
            ends: moment().subtract(1, 'days'),
            status: 'published'
        });

        const res = await request({
            uri: '/events/latest-agora',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.name).toEqual(secondEvent.name);
        expect(res.body.data.id).toEqual(secondEvent.id);
    });

    test('should find latest EPM', async () => {
        await generator.createEvent({
            type: 'epm',
            application_period_starts: moment().subtract(14, 'days'),
            application_period_ends: moment().subtract(13, 'days'),
            board_approve_deadline: moment().subtract(12, 'days'),
            participants_list_publish_deadline: moment().subtract(11, 'days'),
            memberslist_submission_deadline: moment().subtract(10, 'days'),
            starts: moment().subtract(9, 'days'),
            ends: moment().subtract(8, 'days'),
            status: 'published'
        });

        const secondEvent = await generator.createEvent({
            type: 'epm',
            application_period_starts: moment().subtract(7, 'days'),
            application_period_ends: moment().subtract(6, 'days'),
            board_approve_deadline: moment().subtract(5, 'days'),
            participants_list_publish_deadline: moment().subtract(4, 'days'),
            memberslist_submission_deadline: moment().subtract(3, 'days'),
            starts: moment().subtract(2, 'days'),
            ends: moment().subtract(1, 'days'),
            status: 'published'
        });

        const res = await request({
            uri: '/events/latest-epm',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.name).toEqual(secondEvent.name);
        expect(res.body.data.id).toEqual(secondEvent.id);
    });

    test('should find latest SPM', async () => {
        await generator.createEvent({
            type: 'spm',
            application_period_starts: moment().subtract(14, 'days'),
            application_period_ends: moment().subtract(13, 'days'),
            board_approve_deadline: moment().subtract(12, 'days'),
            participants_list_publish_deadline: moment().subtract(11, 'days'),
            memberslist_submission_deadline: moment().subtract(10, 'days'),
            starts: moment().subtract(9, 'days'),
            ends: moment().subtract(8, 'days'),
            status: 'published'
        });

        const secondEvent = await generator.createEvent({
            type: 'spm',
            application_period_starts: moment().subtract(7, 'days'),
            application_period_ends: moment().subtract(6, 'days'),
            board_approve_deadline: moment().subtract(5, 'days'),
            participants_list_publish_deadline: moment().subtract(4, 'days'),
            memberslist_submission_deadline: moment().subtract(3, 'days'),
            starts: moment().subtract(2, 'days'),
            ends: moment().subtract(1, 'days'),
            status: 'published'
        });

        const res = await request({
            uri: '/events/latest-spm',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.name).toEqual(secondEvent.name);
        expect(res.body.data.id).toEqual(secondEvent.id);
    });

    test('should not return not published event on /events/latest', async () => {
        await generator.createEvent({
            application_period_starts: moment().subtract(7, 'days'),
            application_period_ends: moment().subtract(6, 'days'),
            board_approve_deadline: moment().subtract(5, 'days'),
            participants_list_publish_deadline: moment().subtract(4, 'days'),
            memberslist_submission_deadline: moment().subtract(3, 'days'),
            starts: moment().subtract(2, 'days'),
            ends: moment().subtract(1, 'days'),
            status: 'draft'
        });

        const res = await request({
            uri: '/events/latest',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
    });

    test('should not return not published event on /events/latest-agora', async () => {
        await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(7, 'days'),
            application_period_ends: moment().subtract(6, 'days'),
            board_approve_deadline: moment().subtract(5, 'days'),
            participants_list_publish_deadline: moment().subtract(4, 'days'),
            memberslist_submission_deadline: moment().subtract(3, 'days'),
            starts: moment().subtract(2, 'days'),
            ends: moment().subtract(1, 'days'),
            status: 'draft'
        });

        const res = await request({
            uri: '/events/latest-agora',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
    });

    test('should not return not published event on /events/latest-epm', async () => {
        await generator.createEvent({
            type: 'epm',
            application_period_starts: moment().subtract(7, 'days'),
            application_period_ends: moment().subtract(6, 'days'),
            board_approve_deadline: moment().subtract(5, 'days'),
            participants_list_publish_deadline: moment().subtract(4, 'days'),
            memberslist_submission_deadline: moment().subtract(3, 'days'),
            starts: moment().subtract(2, 'days'),
            ends: moment().subtract(1, 'days'),
            status: 'draft'
        });

        const res = await request({
            uri: '/events/latest-epm',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
    });
});
