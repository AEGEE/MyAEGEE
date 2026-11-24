const moment = require('moment');
const tk = require('timekeeper');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { at, fixedDates, BEFORE_EVERYTHING } = require('../scripts/fixed-event');

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
        tk.reset();
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
            path: '/',
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
            path: '/',
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
            path: '/',
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
            path: '/',
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
            path: '/?search=test',
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
            path: '/?starts=' + moment().format('YYYY-MM-DD'),
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
            path: '/?ends=' + moment().format('YYYY-MM-DD'),
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
            path: '/?type=agora',
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
            path: '/?type[]=agora&type[]=epm',
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
            path: '/recents',
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
            path: '/recents?ends=' + ends,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].latest_event).toEqual(previousEvent.ends.toISOString());
    });

    test.each([
        ['/', { starts: 'not-a-date' }, 'starts'],
        ['/', { ends: 'not-a-date' }, 'ends'],
        ['/', { starts: ['2018-01-01', '2019-01-01'] }, 'starts'],
        ['/recents', { ends: 'not-a-date' }, 'ends']
    ])('should return 400 on %s if the date in %j is invalid', async (path, query, field) => {
        const res = await request({
            path,
            query,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body.message).toEqual(`The "${field}" date is invalid, it should be in the YYYY-MM-DD format.`);
        expect(res.body).not.toHaveProperty('data');
    });

    // The day of a date filter is a day on the Central European calendar, whatever the time
    // zone of the server: in May that day starts at 22:00 UTC of the day before.
    describe('the date filters of the list', () => {
        // The events of these tests have the fixed dates: the clock stands before all of
        // them, unless a test sets it itself.
        beforeEach(() => {
            tk.freeze(BEFORE_EVERYTHING);
        });

        const startOfDay = new Date('2030-05-05T22:00:00.000Z'); // 6 May 2030, 00:00 in Central Europe
        const endOfDay = new Date('2030-05-10T21:59:59.999Z'); // 10 May 2030, 23:59:59.999 in Central Europe

        const list = async (query) => {
            const res = await request({
                path: '/',
                query,
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            return res.body.data.map((event) => event.id);
        };

        test('should include an event that starts at the first moment of the "starts" day (inclusive), not one that starts 1 ms earlier', async () => {
            const onTheDay = await generator.createEvent(fixedDates({ starts: startOfDay }));
            const justBefore = await generator.createEvent(fixedDates({ starts: new Date(startOfDay.getTime() - 1) }));

            expect(await list({ starts: '2030-05-06' })).toEqual([onTheDay.id]);
            expect(await list({ starts: '2030-05-05' })).toEqual([onTheDay.id, justBefore.id]);
        });

        test('should include an event that ends at the last moment of the "ends" day (inclusive), not one that ends 1 ms later', async () => {
            const onTheDay = await generator.createEvent(fixedDates({ ends: endOfDay }));
            const justAfter = await generator.createEvent(fixedDates({ starts: at('starts', 1), ends: new Date(endOfDay.getTime() + 1) }));

            expect(await list({ ends: '2030-05-10' })).toEqual([onTheDay.id]);
            expect(await list({ ends: '2030-05-11' })).toEqual([justAfter.id, onTheDay.id]);
        });

        test('should only list the events that lie between the two days as a whole', async () => {
            const inside = await generator.createEvent(fixedDates());
            await generator.createEvent(fixedDates({ starts: at('starts', -7 * 86400000) }));
            await generator.createEvent(fixedDates({ ends: at('ends', 7 * 86400000) }));

            expect(await list({ starts: '2030-05-06', ends: '2030-05-10' })).toEqual([inside.id]);
        });

        test('should list nothing when no event lies between the two days', async () => {
            await generator.createEvent(fixedDates());

            expect(await list({ starts: '2030-05-07', ends: '2030-05-10' })).toEqual([]);
        });

        test.each(['2030-02-30', '2030-13-01', '2030-00-10'])('should return 400 for the day %s, which does not exist', async (day) => {
            const res = await request({
                path: '/',
                query: { starts: day },
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(400);
            expect(res.body.message).toEqual('The "starts" date is invalid, it should be in the YYYY-MM-DD format.');
        });
    });

    describe('the other filters of the list', () => {
        test('should give an anonymous caller the same list as a member', async () => {
            await generator.createEvent({ type: 'agora' });
            await generator.createEvent({ type: 'epm' });

            const asMember = await request({
                path: '/',
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            mock.mockAll({
                core: { unauthorized: true },
                mainPermissions: { unauthorized: true },
                approvePermissions: { unauthorized: true },
                memberslistPermissions: { unauthorized: true }
            });

            const asAnonymous = await request({ path: '/', method: 'GET' });

            expect(asAnonymous.statusCode).toEqual(200);
            expect(asAnonymous.body.data.length).toEqual(2);
            expect(asAnonymous.body).toEqual(asMember.body);
        });

        test('should list an event with its image and without permissions', async () => {
            await generator.createEvent({ type: 'agora' });

            const res = await request({
                path: '/',
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data[0].image).toEqual(null);
            expect(res.body.data[0]).not.toHaveProperty('permissions');
            expect(res.body.data[0]).not.toHaveProperty('applications');
        });

        test('should find a part of a word, in any case', async () => {
            const event = await generator.createEvent({ name: 'Autumn Agora Enschede', description: 'other' });
            await generator.createEvent({ name: 'other', description: 'other' });

            const res = await request({
                path: '/',
                query: { search: 'SCHED' },
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.map((e) => e.id)).toEqual([event.id]);
        });

        test('should combine the search with the type', async () => {
            const event = await generator.createEvent({ type: 'agora', name: 'Autumn Agora', description: 'other' });
            await generator.createEvent({ type: 'epm', name: 'Autumn EPM', description: 'other' });
            await generator.createEvent({ type: 'agora', name: 'Spring Agora', description: 'other' });

            const res = await request({
                path: '/',
                query: { search: 'autumn', type: 'agora' },
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.map((e) => e.id)).toEqual([event.id]);
        });

        test('should list nothing when nothing matches', async () => {
            await generator.createEvent({ type: 'agora', name: 'Autumn Agora', description: 'other' });

            const res = await request({
                path: '/',
                query: { search: 'spring' },
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toEqual([]);
        });

        test('should search for % and _ as they are written', async () => {
            const first = await generator.createEvent({ name: 'A discount of 50% for members', description: 'other' });
            await generator.createEvent({ name: 'An Agora for 500 members', description: 'other' });

            const res = await request({
                path: '/',
                query: { search: '50%' },
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.map((e) => e.id)).toEqual([first.id]);
        });
    });

    describe('the latest event per body', () => {
        // The events of these tests have the fixed dates: the clock stands before all of
        // them, unless a test sets it itself.
        beforeEach(() => {
            tk.freeze(BEFORE_EVERYTHING);
        });

        const recents = async (query) => {
            const res = await request({
                path: '/recents',
                query,
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            return res.body.data.sort((a, b) => a.body_id - b.body_id);
        };

        test('should give one entry per organising body, with the end of its published event that ends last', async () => {
            await generator.createEvent({ body_id: 1, type: 'agora', ...fixedDates() });
            await generator.createEvent({ body_id: 1, type: 'epm', ...fixedDates({ ends: at('ends', 86400000) }) });
            await generator.createEvent({ body_id: 2, ...fixedDates({ ends: at('ends', -3600000) }) });
            // Drafts do not count: not for a body that has published events, not for one that has none.
            await generator.createEvent({ body_id: 1, status: 'draft', ...fixedDates({ ends: at('ends', 30 * 86400000) }) });
            await generator.createEvent({ body_id: 3, status: 'draft', ...fixedDates() });

            expect(await recents()).toEqual([
                { body_id: 1, latest_event: at('ends', 86400000).toISOString() },
                { body_id: 2, latest_event: at('ends', -3600000).toISOString() }
            ]);
        });

        test('should give an empty list when nothing is published', async () => {
            await generator.createEvent({ status: 'draft' });

            expect(await recents()).toEqual([]);
        });

        test('should answer a member without permissions', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            await generator.createEvent({ body_id: 1, ...fixedDates() });

            expect(await recents()).toEqual([{ body_id: 1, latest_event: at('ends').toISOString() }]);
        });

        // As for the list: a day on the Central European calendar.
        test('should include an event that ends at the last moment of the "ends" day (inclusive), not one that ends 1 ms later', async () => {
            const endOfDay = new Date('2030-05-10T21:59:59.999Z');
            await generator.createEvent({ body_id: 1, ...fixedDates({ ends: endOfDay }) });
            await generator.createEvent({ body_id: 2, ...fixedDates({ ends: new Date(endOfDay.getTime() + 1) }) });

            expect(await recents({ ends: '2030-05-10' })).toEqual([{ body_id: 1, latest_event: endOfDay.toISOString() }]);
            expect(await recents({ ends: '2030-05-11' })).toEqual([
                { body_id: 1, latest_event: endOfDay.toISOString() },
                { body_id: 2, latest_event: new Date(endOfDay.getTime() + 1).toISOString() }
            ]);
        });

        test('should give the end of the last event that ended by the "ends" day when a later one exists', async () => {
            await generator.createEvent({ body_id: 1, ...fixedDates() });
            await generator.createEvent({ body_id: 1, ...fixedDates({ ends: at('ends', 30 * 86400000) }) });

            expect(await recents({ ends: '2030-05-20' })).toEqual([{ body_id: 1, latest_event: at('ends').toISOString() }]);
        });
    });
});
