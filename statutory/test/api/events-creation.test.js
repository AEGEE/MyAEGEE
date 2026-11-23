const moment = require('moment');
const tk = require('timekeeper');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { at, fixedDates } = require('../scripts/fixed-event');
const { Event, Image } = require('../../models');

describe('Events creation', () => {
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
        tk.reset();
        mock.cleanAll();
        await generator.clearAll();
    });

    test('should fail if user does not have rights to create events', async () => {
        mock.mockAll({ core: { regularUser: true } });
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
    });

    test('should succeed if everything is okay', async () => {
        const event = generator.generateEvent();

        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: event
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.name).toEqual(event.name);
        expect(res.body.data.description).toEqual(event.description);
        expect(res.body.data.fee).toEqual(event.fee);
        expect(res.body.data.type).toEqual(event.type);

        const eventFromDb = await Event.findOne({ where: { id: res.body.data.id } });

        expect(eventFromDb.name).toEqual(res.body.data.name);
        expect(eventFromDb.description).toEqual(res.body.data.description);
        expect(eventFromDb.fee).toEqual(res.body.data.fee);
        expect(eventFromDb.type).toEqual(res.body.data.type);

        for (const question of event.questions) {
            expect(eventFromDb.questions.find((q) => question.name === q.name)).toBeTruthy();
        }
    });

    test('should ignore the image_id from the body', async () => {
        const otherImage = await Image.create({ user_id: 1337, file_name: 'other.png', file_folder: 'test' });
        const event = generator.generateEvent({ image_id: otherImage.id });

        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: event
        });

        expect(res.statusCode).toEqual(200);
        const eventFromDb = await Event.findByPk(res.body.data.id);
        expect(eventFromDb.image_id).toEqual(null);
    });

    test('should fail if the event is invalid', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                url: 'not a valid url with spaces'
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(Object.keys(res.body.errors).length).toEqual(1);
        expect(res.body.errors).toHaveProperty('url');
    });

    test('should fail if the event is numbers only', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                url: '12345'
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(Object.keys(res.body.errors).length).toEqual(1);
        expect(res.body.errors).toHaveProperty('url');
    });

    it('should return 422 if URL is not unique', async () => {
        await generator.createEvent({ url: 'non-unique-url' });

        const event = generator.generateEvent({
            url: 'non-unique-URL'
        });

        const res = await request({
            path: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('url');
    });

    test('should fail if event ends before it starts', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                application_period_starts: moment().add(1, 'months').toDate(),
                application_period_ends: moment().add(2, 'months').toDate(),
                board_approve_deadline: moment().add(3, 'months').toDate(),
                participants_list_publish_deadline: moment().add(4, 'months').toDate(),
                memberslist_submission_deadline: moment().add(5, 'months').toDate(),
                draft_proposal_deadline: moment().add(4, 'months').toDate(),
                final_proposal_deadline: moment().add(5, 'months').toDate(),
                candidature_deadline: moment().add(5, 'months').toDate(),
                booklet_publication_deadline: moment().add(4, 'months').toDate(),
                updated_booklet_publication_deadline: moment().add(5, 'months').toDate(),
                starts: moment().add(7, 'months').toDate(),
                ends: moment().add(6, 'months').toDate()
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(Object.keys(res.body.errors).length).toEqual(1);
        expect(res.body.errors).toHaveProperty('ends');
    });

    test('should fail if event application period ends before it starts', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                application_period_starts: moment().add(2, 'months').toDate(),
                application_period_ends: moment().add(1, 'months').toDate(),
                board_approve_deadline: moment().add(3, 'months').toDate(),
                participants_list_publish_deadline: moment().add(4, 'months').toDate(),
                memberslist_submission_deadline: moment().add(5, 'months').toDate(),
                draft_proposal_deadline: moment().add(4, 'months').toDate(),
                final_proposal_deadline: moment().add(5, 'months').toDate(),
                candidature_deadline: moment().add(5, 'months').toDate(),
                booklet_publication_deadline: moment().add(4, 'months').toDate(),
                updated_booklet_publication_deadline: moment().add(5, 'months').toDate(),
                starts: moment().add(6, 'months').toDate(),
                ends: moment().add(7, 'months').toDate()
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(Object.keys(res.body.errors).length).toEqual(1);
        expect(res.body.errors).toHaveProperty('application_period_ends');
    });

    test('should fail if event starts before application period ends', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                application_period_starts: moment().add(1, 'months').toDate(),
                application_period_ends: moment().add(3, 'months').toDate(),
                starts: moment().add(2, 'months').toDate(),
                board_approve_deadline: moment().add(4, 'months').toDate(),
                memberslist_submission_deadline: moment().add(5, 'months').toDate(),
                participants_list_publish_deadline: moment().add(6, 'months').toDate(),
                ends: moment().add(7, 'months').toDate()
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body.errors).toHaveProperty('application_period_ends');
    });

    test('should fail if board approve_deadline is before application period ends', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                application_period_starts: moment().add(1, 'months').toDate(),
                application_period_ends: moment().add(3, 'months').toDate(),
                board_approve_deadline: moment().add(2, 'months').toDate(),
                participants_list_publish_deadline: moment().add(4, 'months').toDate(),
                memberslist_submission_deadline: moment().add(5, 'months').toDate(),
                starts: moment().add(6, 'months').toDate(),
                ends: moment().add(7, 'months').toDate()
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body.errors).toHaveProperty('board_approve_deadline');
    });

    test('should allow pax list publish deadline before board approve deadline', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                application_period_starts: moment().add(1, 'months').toDate(),
                application_period_ends: moment().add(2, 'months').toDate(),
                board_approve_deadline: moment().add(4, 'months').toDate(),
                participants_list_publish_deadline: moment().add(3, 'months').toDate(),
                memberslist_submission_deadline: moment().add(5, 'months').toDate(),
                starts: moment().add(6, 'months').toDate(),
                ends: moment().add(7, 'months').toDate()
            })
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
    });

    test('should set application status reveal date if publish deadline is already in the past', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                application_period_starts: moment().subtract(5, 'months').toDate(),
                application_period_ends: moment().subtract(4, 'months').toDate(),
                board_approve_deadline: moment().subtract(3, 'months').toDate(),
                participants_list_publish_deadline: moment().subtract(2, 'months').toDate(),
                memberslist_submission_deadline: moment().subtract(1, 'months').toDate(),
                starts: moment().add(1, 'months').toDate(),
                ends: moment().add(2, 'months').toDate()
            })
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.application_status_revealed_at).toBeTruthy();
    });

    test('should fail if pax list publish deadline is before event starts', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                application_period_starts: moment().add(1, 'months').toDate(),
                application_period_ends: moment().add(2, 'months').toDate(),
                board_approve_deadline: moment().add(3, 'months').toDate(),
                participants_list_publish_deadline: moment().add(5, 'months').toDate(),
                memberslist_submission_deadline: moment().add(6, 'months').toDate(),
                starts: moment().add(4, 'months').toDate(),
                ends: moment().add(7, 'months').toDate()
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body.errors).toHaveProperty('participants_list_publish_deadline');
    });

    test('should fail if memberslist_submission_deadline is after event starts', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                application_period_starts: moment().add(1, 'months').toDate(),
                application_period_ends: moment().add(2, 'months').toDate(),
                board_approve_deadline: moment().add(3, 'months').toDate(),
                participants_list_publish_deadline: moment().add(4, 'months').toDate(),
                memberslist_submission_deadline: moment().add(7, 'months').toDate(),
                draft_proposal_deadline: moment().add(3, 'months').toDate(),
                final_proposal_deadline: moment().add(4, 'months').toDate(),
                candidature_deadline: moment().add(4, 'months').toDate(),
                booklet_publication_deadline: moment().add(3, 'months').toDate(),
                updated_booklet_publication_deadline: moment().add(4, 'months').toDate(),
                starts: moment().add(5, 'months').toDate(),
                ends: moment().add(6, 'months').toDate()
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(Object.keys(res.body.errors).length).toEqual(1);
        expect(res.body.errors).toHaveProperty('memberslist_submission_deadline');
    });

    test('should fail if memberslist_submission_deadline is not set for Agora', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                type: 'agora',
                application_period_starts: moment().add(1, 'months').toDate(),
                application_period_ends: moment().add(2, 'months').toDate(),
                board_approve_deadline: moment().add(3, 'months').toDate(),
                participants_list_publish_deadline: moment().add(4, 'months').toDate(),
                memberslist_submission_deadline: null,
                draft_proposal_deadline: moment().add(4, 'months').toDate(),
                final_proposal_deadline: moment().add(5, 'months').toDate(),
                candidature_deadline: moment().add(5, 'months').toDate(),
                booklet_publication_deadline: moment().add(4, 'months').toDate(),
                updated_booklet_publication_deadline: moment().add(5, 'months').toDate(),
                starts: moment().add(6, 'months').toDate(),
                ends: moment().add(7, 'months').toDate()
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(Object.keys(res.body.errors).length).toEqual(1);
        expect(res.body.errors).toHaveProperty('memberslist_submission_deadline');
    });

    test('should not fail if memberslist_submission_deadline is not set for EPM', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                type: 'epm',
                application_period_starts: moment().add(1, 'months').toDate(),
                application_period_ends: moment().add(2, 'months').toDate(),
                board_approve_deadline: moment().add(3, 'months').toDate(),
                participants_list_publish_deadline: moment().add(4, 'months').toDate(),
                memberslist_submission_deadline: null,
                draft_proposal_deadline: moment().add(4, 'months').toDate(),
                final_proposal_deadline: moment().add(5, 'months').toDate(),
                candidature_deadline: moment().add(5, 'months').toDate(),
                booklet_publication_deadline: moment().add(4, 'months').toDate(),
                updated_booklet_publication_deadline: moment().add(5, 'months').toDate(),
                starts: moment().add(6, 'months').toDate(),
                ends: moment().add(7, 'months').toDate()
            })
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
    });

    test('should fail if memberslist_submission_deadline is invalid for Agora', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                type: 'agora',
                application_period_starts: moment().add(1, 'months').toDate(),
                application_period_ends: moment().add(2, 'months').toDate(),
                board_approve_deadline: moment().add(3, 'months').toDate(),
                participants_list_publish_deadline: moment().add(4, 'months').toDate(),
                memberslist_submission_deadline: 'test',
                draft_proposal_deadline: moment().add(4, 'months').toDate(),
                final_proposal_deadline: moment().add(5, 'months').toDate(),
                candidature_deadline: moment().add(5, 'months').toDate(),
                booklet_publication_deadline: moment().add(4, 'months').toDate(),
                updated_booklet_publication_deadline: moment().add(5, 'months').toDate(),
                starts: moment().add(6, 'months').toDate(),
                ends: moment().add(7, 'months').toDate()
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(Object.keys(res.body.errors).length).toEqual(1);
        expect(res.body.errors).toHaveProperty('memberslist_submission_deadline');
    });

    test('should fail if draft_proposal_deadline is after event starts', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                application_period_starts: moment().add(1, 'months').toDate(),
                application_period_ends: moment().add(2, 'months').toDate(),
                board_approve_deadline: moment().add(3, 'months').toDate(),
                participants_list_publish_deadline: moment().add(4, 'months').toDate(),
                memberslist_submission_deadline: moment().add(4, 'months').toDate(),
                draft_proposal_deadline: moment().add(7, 'months').toDate(),
                final_proposal_deadline: moment().add(4, 'months').toDate(),
                candidature_deadline: moment().add(4, 'months').toDate(),
                booklet_publication_deadline: moment().add(3, 'months').toDate(),
                updated_booklet_publication_deadline: moment().add(4, 'months').toDate(),
                starts: moment().add(5, 'months').toDate(),
                ends: moment().add(6, 'months').toDate()
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(Object.keys(res.body.errors).length).toEqual(2);
        expect(res.body.errors).toHaveProperty('draft_proposal_deadline');
        expect(res.body.errors).toHaveProperty('final_proposal_deadline');
    });

    test('should fail if draft_proposal_deadline is not set for Agora', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                type: 'agora',
                application_period_starts: moment().add(1, 'months').toDate(),
                application_period_ends: moment().add(2, 'months').toDate(),
                board_approve_deadline: moment().add(3, 'months').toDate(),
                participants_list_publish_deadline: moment().add(4, 'months').toDate(),
                memberslist_submission_deadline: moment().add(5, 'months').toDate(),
                draft_proposal_deadline: null,
                final_proposal_deadline: moment().add(5, 'months').toDate(),
                candidature_deadline: moment().add(5, 'months').toDate(),
                booklet_publication_deadline: moment().add(4, 'months').toDate(),
                updated_booklet_publication_deadline: moment().add(5, 'months').toDate(),
                starts: moment().add(6, 'months').toDate(),
                ends: moment().add(7, 'months').toDate()
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(Object.keys(res.body.errors).length).toEqual(1);
        expect(res.body.errors).toHaveProperty('draft_proposal_deadline');
    });

    test('should not fail if draft_proposal_deadline is not set for EPM', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                type: 'epm',
                application_period_starts: moment().add(1, 'months').toDate(),
                application_period_ends: moment().add(2, 'months').toDate(),
                board_approve_deadline: moment().add(3, 'months').toDate(),
                participants_list_publish_deadline: moment().add(4, 'months').toDate(),
                memberslist_submission_deadline: moment().add(5, 'months').toDate(),
                draft_proposal_deadline: null,
                final_proposal_deadline: moment().add(5, 'months').toDate(),
                candidature_deadline: moment().add(5, 'months').toDate(),
                booklet_publication_deadline: moment().add(4, 'months').toDate(),
                updated_booklet_publication_deadline: moment().add(5, 'months').toDate(),
                starts: moment().add(6, 'months').toDate(),
                ends: moment().add(7, 'months').toDate()
            })
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
    });

    test('should fail if draft_proposal_deadline is invalid for Agora', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                type: 'agora',
                application_period_starts: moment().add(1, 'months').toDate(),
                application_period_ends: moment().add(2, 'months').toDate(),
                board_approve_deadline: moment().add(3, 'months').toDate(),
                participants_list_publish_deadline: moment().add(4, 'months').toDate(),
                memberslist_submission_deadline: moment().add(5, 'months').toDate(),
                draft_proposal_deadline: 'test',
                final_proposal_deadline: moment().add(5, 'months').toDate(),
                candidature_deadline: moment().add(5, 'months').toDate(),
                booklet_publication_deadline: moment().add(4, 'months').toDate(),
                updated_booklet_publication_deadline: moment().add(5, 'months').toDate(),
                starts: moment().add(6, 'months').toDate(),
                ends: moment().add(7, 'months').toDate()
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(Object.keys(res.body.errors).length).toEqual(1);
        expect(res.body.errors).toHaveProperty('draft_proposal_deadline');
    });

    test('should fail if final_proposal_deadline is after event starts', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                application_period_starts: moment().add(1, 'months').toDate(),
                application_period_ends: moment().add(2, 'months').toDate(),
                board_approve_deadline: moment().add(3, 'months').toDate(),
                participants_list_publish_deadline: moment().add(4, 'months').toDate(),
                memberslist_submission_deadline: moment().add(4, 'months').toDate(),
                draft_proposal_deadline: moment().add(3, 'months').toDate(),
                final_proposal_deadline: moment().add(7, 'months').toDate(),
                candidature_deadline: moment().add(4, 'months').toDate(),
                booklet_publication_deadline: moment().add(3, 'months').toDate(),
                updated_booklet_publication_deadline: moment().add(4, 'months').toDate(),
                starts: moment().add(5, 'months').toDate(),
                ends: moment().add(6, 'months').toDate()
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(Object.keys(res.body.errors).length).toEqual(1);
        expect(res.body.errors).toHaveProperty('final_proposal_deadline');
    });

    test('should fail if final_proposal_deadline is not set for Agora', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                type: 'agora',
                application_period_starts: moment().add(1, 'months').toDate(),
                application_period_ends: moment().add(2, 'months').toDate(),
                board_approve_deadline: moment().add(3, 'months').toDate(),
                participants_list_publish_deadline: moment().add(4, 'months').toDate(),
                memberslist_submission_deadline: moment().add(5, 'months').toDate(),
                draft_proposal_deadline: moment().add(4, 'months').toDate(),
                final_proposal_deadline: null,
                candidature_deadline: moment().add(5, 'months').toDate(),
                booklet_publication_deadline: moment().add(4, 'months').toDate(),
                updated_booklet_publication_deadline: moment().add(5, 'months').toDate(),
                starts: moment().add(6, 'months').toDate(),
                ends: moment().add(7, 'months').toDate()
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(Object.keys(res.body.errors).length).toEqual(1);
        expect(res.body.errors).toHaveProperty('final_proposal_deadline');
    });

    test('should not fail if final_proposal_deadline is not set for EPM', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                type: 'epm',
                application_period_starts: moment().add(1, 'months').toDate(),
                application_period_ends: moment().add(2, 'months').toDate(),
                board_approve_deadline: moment().add(3, 'months').toDate(),
                participants_list_publish_deadline: moment().add(4, 'months').toDate(),
                memberslist_submission_deadline: moment().add(5, 'months').toDate(),
                draft_proposal_deadline: moment().add(4, 'months').toDate(),
                final_proposal_deadline: null,
                candidature_deadline: moment().add(5, 'months').toDate(),
                booklet_publication_deadline: moment().add(4, 'months').toDate(),
                updated_booklet_publication_deadline: moment().add(5, 'months').toDate(),
                starts: moment().add(6, 'months').toDate(),
                ends: moment().add(7, 'months').toDate()
            })
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
    });

    test('should fail if final_proposal_deadline is invalid for Agora', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                type: 'agora',
                application_period_starts: moment().add(1, 'months').toDate(),
                application_period_ends: moment().add(2, 'months').toDate(),
                board_approve_deadline: moment().add(3, 'months').toDate(),
                participants_list_publish_deadline: moment().add(4, 'months').toDate(),
                memberslist_submission_deadline: moment().add(5, 'months').toDate(),
                draft_proposal_deadline: moment().add(4, 'months').toDate(),
                final_proposal_deadline: 'test',
                candidature_deadline: moment().add(5, 'months').toDate(),
                booklet_publication_deadline: moment().add(4, 'months').toDate(),
                updated_booklet_publication_deadline: moment().add(5, 'months').toDate(),
                starts: moment().add(6, 'months').toDate(),
                ends: moment().add(7, 'months').toDate()
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(Object.keys(res.body.errors).length).toEqual(1);
        expect(res.body.errors).toHaveProperty('final_proposal_deadline');
    });

    test('should fail if final_proposal_deadline is before draft_proposal_deadline', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                application_period_starts: moment().add(1, 'months').toDate(),
                application_period_ends: moment().add(2, 'months').toDate(),
                board_approve_deadline: moment().add(3, 'months').toDate(),
                participants_list_publish_deadline: moment().add(4, 'months').toDate(),
                memberslist_submission_deadline: moment().add(4, 'months').toDate(),
                draft_proposal_deadline: moment().add(4, 'months').toDate(),
                final_proposal_deadline: moment().add(3, 'months').toDate(),
                candidature_deadline: moment().add(4, 'months').toDate(),
                booklet_publication_deadline: moment().add(3, 'months').toDate(),
                updated_booklet_publication_deadline: moment().add(4, 'months').toDate(),
                starts: moment().add(5, 'months').toDate(),
                ends: moment().add(6, 'months').toDate()
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(Object.keys(res.body.errors).length).toEqual(1);
        expect(res.body.errors).toHaveProperty('final_proposal_deadline');
    });

    test('should fail if candidature_deadline is after event starts', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                application_period_starts: moment().add(1, 'months').toDate(),
                application_period_ends: moment().add(2, 'months').toDate(),
                board_approve_deadline: moment().add(3, 'months').toDate(),
                participants_list_publish_deadline: moment().add(4, 'months').toDate(),
                memberslist_submission_deadline: moment().add(4, 'months').toDate(),
                draft_proposal_deadline: moment().add(3, 'months').toDate(),
                final_proposal_deadline: moment().add(4, 'months').toDate(),
                candidature_deadline: moment().add(7, 'months').toDate(),
                booklet_publication_deadline: moment().add(3, 'months').toDate(),
                updated_booklet_publication_deadline: moment().add(4, 'months').toDate(),
                starts: moment().add(5, 'months').toDate(),
                ends: moment().add(6, 'months').toDate()
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(Object.keys(res.body.errors).length).toEqual(1);
        expect(res.body.errors).toHaveProperty('candidature_deadline');
    });

    test('should fail if candidature_deadline is not set for Agora', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                type: 'agora',
                application_period_starts: moment().add(1, 'months').toDate(),
                application_period_ends: moment().add(2, 'months').toDate(),
                board_approve_deadline: moment().add(3, 'months').toDate(),
                participants_list_publish_deadline: moment().add(4, 'months').toDate(),
                memberslist_submission_deadline: moment().add(5, 'months').toDate(),
                draft_proposal_deadline: moment().add(4, 'months').toDate(),
                final_proposal_deadline: moment().add(5, 'months').toDate(),
                candidature_deadline: null,
                booklet_publication_deadline: moment().add(4, 'months').toDate(),
                updated_booklet_publication_deadline: moment().add(5, 'months').toDate(),
                starts: moment().add(6, 'months').toDate(),
                ends: moment().add(7, 'months').toDate()
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(Object.keys(res.body.errors).length).toEqual(1);
        expect(res.body.errors).toHaveProperty('candidature_deadline');
    });

    test('should not fail if candidature_deadline is not set for EPM', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                type: 'epm',
                application_period_starts: moment().add(1, 'months').toDate(),
                application_period_ends: moment().add(2, 'months').toDate(),
                board_approve_deadline: moment().add(3, 'months').toDate(),
                participants_list_publish_deadline: moment().add(4, 'months').toDate(),
                memberslist_submission_deadline: moment().add(5, 'months').toDate(),
                draft_proposal_deadline: moment().add(4, 'months').toDate(),
                final_proposal_deadline: moment().add(5, 'months').toDate(),
                candidature_deadline: null,
                booklet_publication_deadline: moment().add(4, 'months').toDate(),
                updated_booklet_publication_deadline: moment().add(5, 'months').toDate(),
                starts: moment().add(6, 'months').toDate(),
                ends: moment().add(7, 'months').toDate()
            })
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
    });

    test('should fail if candidature_deadline is invalid for Agora', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                type: 'agora',
                application_period_starts: moment().add(1, 'months').toDate(),
                application_period_ends: moment().add(2, 'months').toDate(),
                board_approve_deadline: moment().add(3, 'months').toDate(),
                participants_list_publish_deadline: moment().add(4, 'months').toDate(),
                memberslist_submission_deadline: moment().add(5, 'months').toDate(),
                draft_proposal_deadline: moment().add(4, 'months').toDate(),
                final_proposal_deadline: moment().add(5, 'months').toDate(),
                candidature_deadline: 'test',
                booklet_publication_deadline: moment().add(4, 'months').toDate(),
                updated_booklet_publication_deadline: moment().add(5, 'months').toDate(),
                starts: moment().add(6, 'months').toDate(),
                ends: moment().add(7, 'months').toDate()
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(Object.keys(res.body.errors).length).toEqual(1);
        expect(res.body.errors).toHaveProperty('candidature_deadline');
    });

    test('should fail if booklet_publication_deadline is after event starts', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                application_period_starts: moment().add(1, 'months').toDate(),
                application_period_ends: moment().add(2, 'months').toDate(),
                board_approve_deadline: moment().add(3, 'months').toDate(),
                participants_list_publish_deadline: moment().add(4, 'months').toDate(),
                memberslist_submission_deadline: moment().add(4, 'months').toDate(),
                draft_proposal_deadline: moment().add(3, 'months').toDate(),
                final_proposal_deadline: moment().add(4, 'months').toDate(),
                candidature_deadline: moment().add(4, 'months').toDate(),
                booklet_publication_deadline: moment().add(7, 'months').toDate(),
                updated_booklet_publication_deadline: moment().add(4, 'months').toDate(),
                starts: moment().add(5, 'months').toDate(),
                ends: moment().add(6, 'months').toDate()
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(Object.keys(res.body.errors).length).toEqual(2);
        expect(res.body.errors).toHaveProperty('booklet_publication_deadline');
        expect(res.body.errors).toHaveProperty('updated_booklet_publication_deadline');
    });

    test('should fail if booklet_publication_deadline is not set for Agora', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                type: 'agora',
                application_period_starts: moment().add(1, 'months').toDate(),
                application_period_ends: moment().add(2, 'months').toDate(),
                board_approve_deadline: moment().add(3, 'months').toDate(),
                participants_list_publish_deadline: moment().add(4, 'months').toDate(),
                memberslist_submission_deadline: moment().add(5, 'months').toDate(),
                draft_proposal_deadline: moment().add(4, 'months').toDate(),
                final_proposal_deadline: moment().add(5, 'months').toDate(),
                candidature_deadline: moment().add(5, 'months').toDate(),
                booklet_publication_deadline: null,
                updated_booklet_publication_deadline: moment().add(5, 'months').toDate(),
                starts: moment().add(6, 'months').toDate(),
                ends: moment().add(7, 'months').toDate()
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(Object.keys(res.body.errors).length).toEqual(1);
        expect(res.body.errors).toHaveProperty('booklet_publication_deadline');
    });

    test('should not fail if booklet_publication_deadline is not set for EPM', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                type: 'epm',
                application_period_starts: moment().add(1, 'months').toDate(),
                application_period_ends: moment().add(2, 'months').toDate(),
                board_approve_deadline: moment().add(3, 'months').toDate(),
                participants_list_publish_deadline: moment().add(4, 'months').toDate(),
                memberslist_submission_deadline: moment().add(5, 'months').toDate(),
                draft_proposal_deadline: moment().add(4, 'months').toDate(),
                final_proposal_deadline: moment().add(5, 'months').toDate(),
                candidature_deadline: moment().add(5, 'months').toDate(),
                booklet_publication_deadline: null,
                updated_booklet_publication_deadline: moment().add(5, 'months').toDate(),
                starts: moment().add(6, 'months').toDate(),
                ends: moment().add(7, 'months').toDate()
            })
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
    });

    test('should fail if booklet_publication_deadline is invalid for Agora', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                type: 'agora',
                application_period_starts: moment().add(1, 'months').toDate(),
                application_period_ends: moment().add(2, 'months').toDate(),
                board_approve_deadline: moment().add(3, 'months').toDate(),
                participants_list_publish_deadline: moment().add(4, 'months').toDate(),
                memberslist_submission_deadline: moment().add(5, 'months').toDate(),
                draft_proposal_deadline: moment().add(4, 'months').toDate(),
                final_proposal_deadline: moment().add(5, 'months').toDate(),
                candidature_deadline: moment().add(5, 'months').toDate(),
                booklet_publication_deadline: 'test',
                updated_booklet_publication_deadline: moment().add(5, 'months').toDate(),
                starts: moment().add(6, 'months').toDate(),
                ends: moment().add(7, 'months').toDate()
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(Object.keys(res.body.errors).length).toEqual(1);
        expect(res.body.errors).toHaveProperty('booklet_publication_deadline');
    });

    test('should fail if updated_booklet_publication_deadline is after event starts', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                application_period_starts: moment().add(1, 'months').toDate(),
                application_period_ends: moment().add(2, 'months').toDate(),
                board_approve_deadline: moment().add(3, 'months').toDate(),
                participants_list_publish_deadline: moment().add(4, 'months').toDate(),
                memberslist_submission_deadline: moment().add(4, 'months').toDate(),
                draft_proposal_deadline: moment().add(3, 'months').toDate(),
                final_proposal_deadline: moment().add(4, 'months').toDate(),
                candidature_deadline: moment().add(4, 'months').toDate(),
                booklet_publication_deadline: moment().add(3, 'months').toDate(),
                updated_booklet_publication_deadline: moment().add(7, 'months').toDate(),
                starts: moment().add(5, 'months').toDate(),
                ends: moment().add(6, 'months').toDate()
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(Object.keys(res.body.errors).length).toEqual(1);
        expect(res.body.errors).toHaveProperty('updated_booklet_publication_deadline');
    });

    test('should fail if updated_booklet_publication_deadline is not set for Agora', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                type: 'agora',
                application_period_starts: moment().add(1, 'months').toDate(),
                application_period_ends: moment().add(2, 'months').toDate(),
                board_approve_deadline: moment().add(3, 'months').toDate(),
                participants_list_publish_deadline: moment().add(4, 'months').toDate(),
                memberslist_submission_deadline: moment().add(5, 'months').toDate(),
                draft_proposal_deadline: moment().add(4, 'months').toDate(),
                final_proposal_deadline: moment().add(5, 'months').toDate(),
                candidature_deadline: moment().add(5, 'months').toDate(),
                booklet_publication_deadline: moment().add(4, 'months').toDate(),
                updated_booklet_publication_deadline: null,
                starts: moment().add(6, 'months').toDate(),
                ends: moment().add(7, 'months').toDate()
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(Object.keys(res.body.errors).length).toEqual(1);
        expect(res.body.errors).toHaveProperty('updated_booklet_publication_deadline');
    });

    test('should not fail if updated_booklet_publication_deadline is not set for EPM', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                type: 'epm',
                application_period_starts: moment().add(1, 'months').toDate(),
                application_period_ends: moment().add(2, 'months').toDate(),
                board_approve_deadline: moment().add(3, 'months').toDate(),
                participants_list_publish_deadline: moment().add(4, 'months').toDate(),
                memberslist_submission_deadline: moment().add(5, 'months').toDate(),
                draft_proposal_deadline: moment().add(4, 'months').toDate(),
                final_proposal_deadline: moment().add(5, 'months').toDate(),
                candidature_deadline: moment().add(5, 'months').toDate(),
                booklet_publication_deadline: moment().add(4, 'months').toDate(),
                updated_booklet_publication_deadline: null,
                starts: moment().add(6, 'months').toDate(),
                ends: moment().add(7, 'months').toDate()
            })
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
    });

    test('should fail if updated_booklet_publication_deadline is invalid for Agora', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                type: 'agora',
                application_period_starts: moment().add(1, 'months').toDate(),
                application_period_ends: moment().add(2, 'months').toDate(),
                board_approve_deadline: moment().add(3, 'months').toDate(),
                participants_list_publish_deadline: moment().add(4, 'months').toDate(),
                memberslist_submission_deadline: moment().add(5, 'months').toDate(),
                draft_proposal_deadline: moment().add(4, 'months').toDate(),
                final_proposal_deadline: moment().add(5, 'months').toDate(),
                candidature_deadline: moment().add(5, 'months').toDate(),
                booklet_publication_deadline: moment().add(4, 'months').toDate(),
                updated_booklet_publication_deadline: 'test',
                starts: moment().add(6, 'months').toDate(),
                ends: moment().add(7, 'months').toDate()
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(Object.keys(res.body.errors).length).toEqual(1);
        expect(res.body.errors).toHaveProperty('updated_booklet_publication_deadline');
    });

    test('should fail if updated_booklet_publication_deadline is before booklet_publication_deadline', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                application_period_starts: moment().add(1, 'months').toDate(),
                application_period_ends: moment().add(2, 'months').toDate(),
                board_approve_deadline: moment().add(3, 'months').toDate(),
                participants_list_publish_deadline: moment().add(4, 'months').toDate(),
                memberslist_submission_deadline: moment().add(4, 'months').toDate(),
                draft_proposal_deadline: moment().add(3, 'months').toDate(),
                final_proposal_deadline: moment().add(4, 'months').toDate(),
                candidature_deadline: moment().add(4, 'months').toDate(),
                booklet_publication_deadline: moment().add(4, 'months').toDate(),
                updated_booklet_publication_deadline: moment().add(3, 'months').toDate(),
                starts: moment().add(5, 'months').toDate(),
                ends: moment().add(6, 'months').toDate()
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(Object.keys(res.body.errors).length).toEqual(1);
        expect(res.body.errors).toHaveProperty('updated_booklet_publication_deadline');
    });

    test('should fail if questions is empty array', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                questions: []
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
    });

    test('should fail if questions is not an array', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                questions: {},
                applications: []
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
    });

    test('should fail if questions are malformed', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                questions: ['']
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
    });

    test('should fail if question.description is not set', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                questions: [generator.generateQuestionForEvent({ description: null })]
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
    });

    test('should fail if question.description is not string', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                questions: [generator.generateQuestionForEvent({ description: { test: 'test' } })]
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
    });

    test('should fail if question.required is not set', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                questions: [generator.generateQuestionForEvent({ required: null })]
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
    });

    test('should fail if question.required is not string', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                questions: [generator.generateQuestionForEvent({ required: { test: 'test' } })]
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
    });

    test('should fail if question.values is not an array when type is select', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                questions: [generator.generateQuestionForEvent({ values: null, type: 'select' })]
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
    });

    test('should fail if question.values.* is invalid when type is select', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                questions: [generator.generateQuestionForEvent({ values: [{ test: 'test' }], type: 'select' })]
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
    });

    test('should fail if question type is not set or invalid', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                questions: [generator.generateQuestionForEvent({ type: null })]
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
    });

    test('should fail if question type is unknown', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                questions: [generator.generateQuestionForEvent({ type: 'test' })]
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
    });

    test('should fail if question value is empty', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                questions: [generator.generateQuestionForEvent({ values: [''], type: 'select' })]
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
    });

    test('should succeed if type is select and everything is valid', async () => {
        const res = await request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({
                questions: [generator.generateQuestionForEvent({ values: ['test'], type: 'select' })]
            })
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
    });

    it('should return 422 if the locations is not an array', async () => {
        const event = generator.generateEvent({ locations: false });

        const res = await request({
            path: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('locations');
    });

    it('should return 422 if the locations is not an array', async () => {
        const event = generator.generateEvent({ locations: false });

        const res = await request({
            path: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('locations');
    });

    it('should return 422 if the locations.position is not an object', async () => {
        const event = generator.generateEvent({ locations: [false] });

        const res = await request({
            path: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('locations');
    });

    it('should return 422 if the locations.position[].name is not a string', async () => {
        const event = generator.generateEvent({ locations: [{ name: false }] });

        const res = await request({
            path: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('locations');
    });

    it('should return 422 if the locations.position[].name is empty', async () => {
        const event = generator.generateEvent({ locations: [{ name: '       ' }] });

        const res = await request({
            path: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('locations');
    });

    it('should return 422 if the locations.position[].position is invalid', async () => {
        const event = generator.generateEvent({ locations: [{ name: 'test', position: false }] });

        const res = await request({
            path: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('locations');
    });

    it('should return 422 if the locations.position[].position.lat is invalid', async () => {
        const event = generator.generateEvent({ locations: [{ name: 'test', position: { lat: false, lng: 1 } }] });

        const res = await request({
            path: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('locations');
    });

    it('should return 422 if the locations.position[].position.lat is invalid', async () => {
        const event = generator.generateEvent({ locations: [{ name: 'test', position: { lat: 1, lng: false } }] });

        const res = await request({
            path: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('locations');
    });

    it('should return 200 if locations is valid', async () => {
        const event = generator.generateEvent({ locations: [{ name: 'test', position: { lat: 1, lng: 1 } }] });

        const res = await request({
            path: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
    });

    describe('who may create an event', () => {
        test.each(['agora', 'epm', 'spm'])('should let the holder of global:manage_event:%s alone create such an event', async (type) => {
            mock.mockAll({ mainPermissions: { permissions: ['global:manage_event:' + type] } });

            const res = await request({
                path: '/',
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: generator.generateEvent({ type, ...fixedDates() })
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.type).toEqual(type);

            const eventFromDb = await Event.findByPk(res.body.data.id);
            expect(eventFromDb.type).toEqual(type);
        });

        test.each([
            ['agora', ['global:manage_event:epm', 'global:manage_event:spm']],
            ['epm', ['global:manage_event:agora', 'global:manage_event:spm']],
            ['spm', ['global:manage_event:agora', 'global:manage_event:epm']],
            ['agora', ['global:manage_applications:agora', 'global:manage_incoming:agora', 'global:approve_members:agora']]
        ])('should refuse a new %s from somebody with %j', async (type, permissions) => {
            mock.mockAll({ mainPermissions: { permissions } });

            const res = await request({
                path: '/',
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: generator.generateEvent({ type, ...fixedDates() })
            });

            expect(res.statusCode).toEqual(403);
            expect(res.body.success).toEqual(false);
            expect(res.body.message).toEqual('You are not allowed to create events of this type.');
            expect(res.body).not.toHaveProperty('data');
            expect(await Event.count()).toEqual(0);
        });

        // The permission for the type is looked up before the event is validated, so a type
        // that does not exist is refused like a type the user may not create.
        test.each([
            ['a type that does not exist', 'conference'],
            ['a type in capitals', 'AGORA'],
            ['no type', undefined],
            ['null as the type', null]
        ])('should answer 403 for %s, also to somebody who may create every type', async (description, type) => {
            mock.mockAll({
                mainPermissions: { permissions: ['global:manage_event:agora', 'global:manage_event:epm', 'global:manage_event:spm'] }
            });

            const res = await request({
                path: '/',
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { ...generator.generateEvent(fixedDates()), type }
            });

            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toEqual('You are not allowed to create events of this type.');
            expect(await Event.count()).toEqual(0);
        });

        // BUG: a list as the type is read as its first value when the permission is looked
        // up (so the holder of the permission passes), and then fails in the database: 500.
        // Expected: 422 with an error on "type", like any other value that is not a type.
        test('should answer 500 for a list as the type', async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:manage_event:agora'] } });

            const res = await request({
                path: '/',
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { ...generator.generateEvent(fixedDates()), type: ['agora'] }
            });

            expect(res.statusCode).toEqual(500);
            expect(res.body.success).toEqual(false);
            expect(await Event.count()).toEqual(0);
        });
    });

    describe('what the body cannot set', () => {
        test('should create a draft whatever status the body asks for', async () => {
            const res = await request({
                path: '/',
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: generator.generateEvent({ type: 'epm', status: 'published', ...fixedDates() })
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.status).toEqual('draft');

            const eventFromDb = await Event.findByPk(res.body.data.id);
            expect(eventFromDb.status).toEqual('draft');
            expect(eventFromDb.publication_date).toEqual(null);
        });

        test('should give the event its own id, not the one in the body', async () => {
            const res = await request({
                path: '/',
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { ...generator.generateEvent({ type: 'epm', ...fixedDates() }), id: 424242 }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.id).not.toEqual(424242);
            expect(await Event.findByPk(424242)).toEqual(null);
            expect(await Event.count()).toEqual(1);
        });

        // BUG: these four are taken from the body: a new draft can carry a publication date,
        // have its application statuses revealed, point to any previous Agora (the server only
        // fills that in for an Agora) and claim another creation date.
        // Expected: ignored, like status, id and image_id.
        test('should store publication_date, application_status_revealed_at, previous_agora_id and created_at from the body', async () => {
            const longAgo = new Date('2020-01-01T00:00:00.000Z');

            const res = await request({
                path: '/',
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: {
                    ...generator.generateEvent({ type: 'epm', ...fixedDates() }),
                    publication_date: longAgo,
                    application_status_revealed_at: longAgo,
                    previous_agora_id: 77,
                    created_at: longAgo
                }
            });

            expect(res.statusCode).toEqual(200);

            const eventFromDb = await Event.findByPk(res.body.data.id);
            expect(eventFromDb.status).toEqual('draft');
            expect(eventFromDb.publication_date).toEqual(longAgo);
            expect(eventFromDb.application_status_revealed_at).toEqual(longAgo);
            expect(eventFromDb.previous_agora_id).toEqual(77);
            expect(eventFromDb.created_at).toEqual(longAgo);
        });
    });

    describe('validation', () => {
        const withoutField = (field) => {
            const event = generator.generateEvent({ type: 'epm', ...fixedDates() });
            delete event[field];
            return event;
        };

        test.each([
            ['an empty name', 'name', { name: '', url: 'an-event' }],
            ['an empty description', 'description', { description: '' }],
            ['a negative fee', 'fee', { fee: -1 }],
            ['a fee that is not a number', 'fee', { fee: 'abc' }],
            ['null as the fee', 'fee', { fee: null }],
            ['a body that is not a number', 'body_id', { body_id: 'abc' }],
            ['null as the body', 'body_id', { body_id: null }],
            ['no questions', 'questions', { questions: [] }],
            // eslint-disable-next-line no-script-url
            ['a booklet folder that is a script', 'booklet_folder', { booklet_folder: 'javascript:alert(1)' }],
            ['a booklet folder on another protocol', 'booklet_folder', { booklet_folder: 'ftp://example.org/booklet' }],
            ['a booklet folder that is not a link', 'booklet_folder', { booklet_folder: 'not a url' }]
        ])('should refuse an event with %s', async (description, field, values) => {
            const res = await request({
                path: '/',
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: generator.generateEvent({ type: 'epm', ...fixedDates(), ...values })
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(res.body).not.toHaveProperty('data');
            expect(Object.keys(res.body.errors)).toEqual([field]);
            expect(await Event.count()).toEqual(0);
        });

        test.each([
            'name',
            'description',
            'starts',
            'ends',
            'application_period_starts',
            'application_period_ends',
            'board_approve_deadline',
            'participants_list_publish_deadline',
            'body_id',
            'questions',
            'fee',
            'url'
        ])('should refuse an event without %s', async (field) => {
            const res = await request({
                path: '/',
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: withoutField(field)
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(res.body.errors).toHaveProperty(field);
            expect(await Event.count()).toEqual(0);
        });

        test('should accept a web link as the booklet folder', async () => {
            const res = await request({
                path: '/',
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: generator.generateEvent({ type: 'epm', ...fixedDates(), booklet_folder: 'https://example.org/booklet' })
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.booklet_folder).toEqual('https://example.org/booklet');
        });

        // The order of the dates, each rule exactly at its boundary: two dates at the same
        // moment are refused everywhere.
        test.each([
            ['the end at the moment of the start', 'ends', { ends: at('starts') }],
            ['the application period ending at the moment it starts', 'application_period_ends', { application_period_ends: at('application_period_starts') }],
            ['the application period ending at the moment the event starts', 'application_period_ends', {
                application_period_ends: at('starts'),
                board_approve_deadline: at('starts', 1),
                starts: at('starts'),
                ends: at('ends')
            }],
            ['the board approve deadline at the moment the application period ends', 'board_approve_deadline', { board_approve_deadline: at('application_period_ends') }],
            ['the board approve deadline at the moment the event starts', 'board_approve_deadline', { board_approve_deadline: at('starts') }],
            ['the board approve deadline 1 ms after the event starts', 'board_approve_deadline', { board_approve_deadline: at('starts', 1) }],
            ['the participants list deadline at the moment the event starts', 'participants_list_publish_deadline', { participants_list_publish_deadline: at('starts') }]
        ])('should refuse %s', async (description, field, dates) => {
            const res = await request({
                path: '/',
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: generator.generateEvent({ type: 'epm', ...fixedDates(dates) })
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty(field);
            expect(await Event.count()).toEqual(0);
        });

        test.each([
            ['the end 1 ms after the start', { ends: at('starts', 1) }],
            ['the application period ending 1 ms after it starts', { application_period_ends: at('application_period_starts', 1) }],
            ['the board approve deadline 1 ms after the application period ends', { board_approve_deadline: at('application_period_ends', 1) }],
            ['the board approve deadline 1 ms before the event starts', { board_approve_deadline: at('starts', -1) }],
            ['the participants list deadline 1 ms before the event starts', { participants_list_publish_deadline: at('starts', -1) }],
            ['the application period ending 1 ms before the event starts', { application_period_ends: at('starts', -2), board_approve_deadline: at('starts', -1) }]
        ])('should accept %s', async (description, dates) => {
            const res = await request({
                path: '/',
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: generator.generateEvent({ type: 'epm', ...fixedDates(dates) })
            });

            expect(res.statusCode).toEqual(200);
            expect(await Event.count()).toEqual(1);
        });
    });

    // The statuses of the applications count as revealed from the participants list deadline
    // on. An event that is created at or after that deadline records the moment.
    describe('application_status_revealed_at', () => {
        const create = () => request({
            path: '/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateEvent({ type: 'epm', ...fixedDates() })
        });

        test('should stay empty when the event is created 1 ms before the participants list deadline', async () => {
            tk.freeze(at('participants_list_publish_deadline', -1));

            const res = await create();

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.application_status_revealed_at).toEqual(null);

            const eventFromDb = await Event.findByPk(res.body.data.id);
            expect(eventFromDb.application_status_revealed_at).toEqual(null);
        });

        test.each([
            ['exactly at the participants list deadline (inclusive)', 0],
            ['1 ms after the participants list deadline', 1]
        ])('should be set to the moment of creation when the event is created %s', async (description, offset) => {
            const now = at('participants_list_publish_deadline', offset);
            tk.freeze(now);

            const res = await create();

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.application_status_revealed_at).toEqual(now.toISOString());

            const eventFromDb = await Event.findByPk(res.body.data.id);
            expect(eventFromDb.application_status_revealed_at).toEqual(now);
        });
    });
});
