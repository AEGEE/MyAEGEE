const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
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

        const ids = res.body.data.map((e) => e.id);
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

        const ids = res.body.data.map((e) => e.id);
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

        const ids = res.body.data.map((e) => e.id);
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
            draft_proposal_deadline: moment().add(4, 'week').toDate(),
            final_proposal_deadline: moment().add(5, 'week').toDate(),
            candidature_deadline: moment().add(5, 'week').toDate(),
            booklet_publication_deadline: moment().add(4, 'week').toDate(),
            updated_booklet_publication_deadline: moment().add(5, 'week').toDate(),
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
            draft_proposal_deadline: moment().add(11, 'week').toDate(),
            final_proposal_deadline: moment().add(12, 'week').toDate(),
            candidature_deadline: moment().add(12, 'week').toDate(),
            booklet_publication_deadline: moment().add(11, 'week').toDate(),
            updated_booklet_publication_deadline: moment().add(12, 'week').toDate(),
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

    test('should filter events by name or description', async () => {
        const first = await generator.createEvent({ status: 'published', name: 'TEST' });
        const second = await generator.createEvent({ status: 'published', description: 'TEST' });
        await generator.createEvent({ status: 'published', name: 'other', description: 'other' });

        const res = await request({
            uri: '/?search=test',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(2);

        const ids = res.body.data.map((e) => e.id);
        expect(ids).toContain(first.id);
        expect(ids).toContain(second.id);
    });

    test('should filter events by start date', async () => {
        const event = await generator.createEvent({
            status: 'published',
            application_period_starts: moment().subtract(7, 'week').toDate(),
            application_period_ends: moment().subtract(6, 'week').toDate(),
            board_approve_deadline: moment().subtract(5, 'week').toDate(),
            participants_list_publish_deadline: moment().subtract(4, 'week').toDate(),
            memberslist_submission_deadline: moment().subtract(3, 'week').toDate(),
            draft_proposal_deadline: moment().subtract(4, 'week').toDate(),
            final_proposal_deadline: moment().subtract(3, 'week').toDate(),
            candidature_deadline: moment().subtract(3, 'week').toDate(),
            booklet_publication_deadline: moment().subtract(4, 'week').toDate(),
            updated_booklet_publication_deadline: moment().subtract(3, 'week').toDate(),
            starts: moment().add(1, 'week').toDate(),
            ends: moment().add(2, 'week').toDate(),
        });

        await generator.createEvent({
            status: 'published',
            application_period_starts: moment().subtract(7, 'week').toDate(),
            application_period_ends: moment().subtract(6, 'week').toDate(),
            board_approve_deadline: moment().subtract(5, 'week').toDate(),
            participants_list_publish_deadline: moment().subtract(4, 'week').toDate(),
            memberslist_submission_deadline: moment().subtract(3, 'week').toDate(),
            draft_proposal_deadline: moment().subtract(4, 'week').toDate(),
            final_proposal_deadline: moment().subtract(3, 'week').toDate(),
            candidature_deadline: moment().subtract(3, 'week').toDate(),
            booklet_publication_deadline: moment().subtract(4, 'week').toDate(),
            updated_booklet_publication_deadline: moment().subtract(3, 'week').toDate(),
            starts: moment().subtract(2, 'week').toDate(),
            ends: moment().add(1, 'week').toDate()
        });

        const res = await request({
            uri: '/?starts=' + moment().format('YYYY-MM-DD'),
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(event.id);
    });

    test('should filter events by end date', async () => {
        const event = await generator.createEvent({
            status: 'published',
            application_period_starts: moment().subtract(7, 'week').toDate(),
            application_period_ends: moment().subtract(6, 'week').toDate(),
            board_approve_deadline: moment().subtract(5, 'week').toDate(),
            participants_list_publish_deadline: moment().subtract(4, 'week').toDate(),
            memberslist_submission_deadline: moment().subtract(3, 'week').toDate(),
            draft_proposal_deadline: moment().subtract(4, 'week').toDate(),
            final_proposal_deadline: moment().subtract(3, 'week').toDate(),
            candidature_deadline: moment().subtract(3, 'week').toDate(),
            booklet_publication_deadline: moment().subtract(4, 'week').toDate(),
            updated_booklet_publication_deadline: moment().subtract(3, 'week').toDate(),
            starts: moment().subtract(2, 'week').toDate(),
            ends: moment().subtract(1, 'week').toDate(),
        });

        await generator.createEvent({
            status: 'published',
            application_period_starts: moment().subtract(7, 'week').toDate(),
            application_period_ends: moment().subtract(6, 'week').toDate(),
            board_approve_deadline: moment().subtract(5, 'week').toDate(),
            participants_list_publish_deadline: moment().subtract(4, 'week').toDate(),
            memberslist_submission_deadline: moment().subtract(3, 'week').toDate(),
            draft_proposal_deadline: moment().subtract(4, 'week').toDate(),
            final_proposal_deadline: moment().subtract(3, 'week').toDate(),
            candidature_deadline: moment().subtract(3, 'week').toDate(),
            booklet_publication_deadline: moment().subtract(4, 'week').toDate(),
            updated_booklet_publication_deadline: moment().subtract(3, 'week').toDate(),
            starts: moment().add(1, 'week').toDate(),
            ends: moment().add(2, 'week').toDate()
        });

        const res = await request({
            uri: '/?ends=' + moment().format('YYYY-MM-DD'),
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(event.id);
    });

    test('should filter by event type if single', async () => {
        const event = await generator.createEvent({ status: 'published', type: 'agora' });
        await generator.createEvent({ status: 'published', type: 'epm' });
        await generator.createEvent({ status: 'published', type: 'spm' });

        const res = await request({
            uri: '/?type=agora',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(event.id);
    });

    test('should filter by event type if array', async () => {
        const first = await generator.createEvent({ status: 'published', type: 'agora' });
        const second = await generator.createEvent({ status: 'published', type: 'epm' });
        await generator.createEvent({ status: 'published', type: 'spm' });

        const res = await request({
            uri: '/?type[]=agora&type[]=epm',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(2);

        const ids = res.body.data.map((e) => e.id);
        expect(ids).toContain(first.id);
        expect(ids).toContain(second.id);
    });

    test('should list most recent events per body', async () => {
        await generator.createEvent({
            status: 'published',
            body_id: 1,
            application_period_starts: moment().subtract(20, 'days').toDate(),
            application_period_ends: moment().subtract(19, 'days').toDate(),
            board_approve_deadline: moment().subtract(18, 'days').toDate(),
            participants_list_publish_deadline: moment().subtract(17, 'days').toDate(),
            memberslist_submission_deadline: moment().subtract(16, 'days').toDate(),
            draft_proposal_deadline: moment().subtract(15, 'days').toDate(),
            final_proposal_deadline: moment().subtract(14, 'days').toDate(),
            candidature_deadline: moment().subtract(13, 'days').toDate(),
            booklet_publication_deadline: moment().subtract(12, 'days').toDate(),
            updated_booklet_publication_deadline: moment().subtract(11, 'days').toDate(),
            starts: moment().subtract(8, 'days').toDate(),
            ends: moment().subtract(7, 'days').toDate(),
        });
        const mostRecentEvent = await generator.createEvent({
            status: 'published',
            body_id: 1,
            application_period_starts: moment().subtract(20, 'days').toDate(),
            application_period_ends: moment().subtract(19, 'days').toDate(),
            board_approve_deadline: moment().subtract(18, 'days').toDate(),
            participants_list_publish_deadline: moment().subtract(17, 'days').toDate(),
            memberslist_submission_deadline: moment().subtract(16, 'days').toDate(),
            draft_proposal_deadline: moment().subtract(15, 'days').toDate(),
            final_proposal_deadline: moment().subtract(14, 'days').toDate(),
            candidature_deadline: moment().subtract(13, 'days').toDate(),
            booklet_publication_deadline: moment().subtract(12, 'days').toDate(),
            updated_booklet_publication_deadline: moment().subtract(11, 'days').toDate(),
            starts: moment().subtract(3, 'days').toDate(),
            ends: moment().subtract(2, 'days').toDate(),
        });

        const res = await request({
            uri: '/recents',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].latest_event).toEqual(mostRecentEvent.ends.toISOString());
    });

    it('should not list most recent events in the future', async () => {
        const previousEvent = await generator.createEvent({
            status: 'published',
            body_id: 1,
            application_period_starts: moment().subtract(40, 'days').toDate(),
            application_period_ends: moment().subtract(39, 'days').toDate(),
            board_approve_deadline: moment().subtract(38, 'days').toDate(),
            participants_list_publish_deadline: moment().subtract(37, 'days').toDate(),
            memberslist_submission_deadline: moment().subtract(36, 'days').toDate(),
            draft_proposal_deadline: moment().subtract(35, 'days').toDate(),
            final_proposal_deadline: moment().subtract(34, 'days').toDate(),
            candidature_deadline: moment().subtract(33, 'days').toDate(),
            booklet_publication_deadline: moment().subtract(32, 'days').toDate(),
            updated_booklet_publication_deadline: moment().subtract(31, 'days').toDate(),
            starts: moment().subtract(18, 'days').toDate(),
            ends: moment().subtract(17, 'days').toDate(),
        });
        await generator.createEvent({
            status: 'published',
            body_id: 1,
            application_period_starts: moment().subtract(20, 'days').toDate(),
            application_period_ends: moment().subtract(19, 'days').toDate(),
            board_approve_deadline: moment().subtract(18, 'days').toDate(),
            participants_list_publish_deadline: moment().subtract(17, 'days').toDate(),
            memberslist_submission_deadline: moment().subtract(16, 'days').toDate(),
            draft_proposal_deadline: moment().subtract(15, 'days').toDate(),
            final_proposal_deadline: moment().subtract(14, 'days').toDate(),
            candidature_deadline: moment().subtract(13, 'days').toDate(),
            booklet_publication_deadline: moment().subtract(12, 'days').toDate(),
            updated_booklet_publication_deadline: moment().subtract(11, 'days').toDate(),
            starts: moment().subtract(3, 'days').toDate(),
            ends: moment().subtract(2, 'days').toDate(),
        });

        const ends = moment().subtract(10, 'days').toISOString();

        const res = await request({
            uri: '/recents?ends=' + ends,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].latest_event).toEqual(previousEvent.ends.toISOString());
    });
});
