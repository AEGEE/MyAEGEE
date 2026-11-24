const moment = require('moment');
const tk = require('timekeeper');
const nock = require('nock');

const config = require('../../config');
const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { at, fixedDates, BEFORE_EVERYTHING } = require('../scripts/fixed-event');
const regularUser = require('../assets/core-valid.json').data;

const NOT_FOUND = 'Event with such url or ID is not found.';

// The user of the core mock is a member of an antenna, of which they are a board member
// in the default mocks, and of a body that is not a local.
const [LOCAL, OTHER_BODY] = regularUser.bodies.map((body) => body.id);

// What somebody who may do nothing gets, outside of every period of the event. `bodies`
// are the bodies of the caller: five permissions have a value for each of them.
const permissionsOf = (changes = {}, bodies = [LOCAL, OTHER_BODY]) => {
    const perBody = (key) => ({
        global: false,
        ...Object.fromEntries(bodies.map((body) => [body, false])),
        ...changes[key]
    });

    return {
        see_background_tasks: false,
        edit_event: false,
        change_event_status: false,
        delete_event: false,
        apply: false,
        use_massmailer: false,
        manage_applications: false,
        manage_incoming: false,
        manage_juridical: false,
        see_applications: false,
        see_applications_juridical: false,
        see_applications_incoming: false,
        see_applications_network: false,
        see_participants_list: false,
        see_missing_memberslist: { global: false },
        see_memberslist_without_fee: { global: false },
        set_memberslists_fee_paid: false,
        manage_candidates: false,
        manage_plenaries: false,
        see_plenaries: false,
        mark_attendance: false,
        // The antenna may send delegates and visitors to an Agora by default, the other body nobody.
        apply_from_body: bodies.length > 0 ? { [LOCAL]: true, [OTHER_BODY]: false } : {},
        manage_question_lines: false,
        see_question_lines: false,
        see_questions: false,
        submit_questions: false,
        ...changes,
        create_event: { agora: false, epm: false, spm: false, ...changes.create_event },
        edit_pax_limits: { agora: false, epm: false, spm: false, ...changes.edit_pax_limits },
        export: { openslides: false, all: false, incoming: false, delegates_jc: false, ...changes.export },
        set_board_comment_and_participant_type: perBody('set_board_comment_and_participant_type'),
        see_boardview: perBody('see_boardview'),
        upload_memberslist: perBody('upload_memberslist'),
        edit_memberslist: perBody('edit_memberslist'),
        see_memberslist: perBody('see_memberslist')
    };
};

const anonymous = () => mock.mockAll({
    core: { unauthorized: true },
    mainPermissions: { unauthorized: true },
    approvePermissions: { unauthorized: true },
    memberslistPermissions: { unauthorized: true }
});

// A member with the given permissions who is in no board.
const memberWith = (permissions) => mock.mockAll({
    mainPermissions: { permissions },
    approvePermissions: { noPermissions: true },
    memberslistPermissions: { noPermissions: true }
});

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
        tk.reset();
        mock.cleanAll();
        await generator.clearAll();
    });

    test('should return 404 if the event is not found', async () => {
        const res = await request({
            path: '/events/nonexistant',
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
            path: '/events/' + event.id,
            method: 'GET'
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.name).toEqual(event.name);
    });

    test('should find event by url', async () => {
        const event = await generator.createEvent({ url: 'test-slug' });
        const res = await request({
            path: '/events/test-slug',
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
            path: '/events/' + event.id,
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
            draft_proposal_deadline: moment().subtract(11, 'days'),
            final_proposal_deadline: moment().subtract(10, 'days'),
            candidature_deadline: moment().subtract(10, 'days'),
            booklet_publication_deadline: moment().subtract(11, 'days'),
            updated_booklet_publication_deadline: moment().subtract(10, 'days'),
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
            draft_proposal_deadline: moment().subtract(4, 'days'),
            final_proposal_deadline: moment().subtract(3, 'days'),
            candidature_deadline: moment().subtract(3, 'days'),
            booklet_publication_deadline: moment().subtract(4, 'days'),
            updated_booklet_publication_deadline: moment().subtract(3, 'days'),
            starts: moment().subtract(2, 'days'),
            ends: moment().subtract(1, 'days'),
            status: 'published'
        });

        const res = await request({
            path: '/events/latest',
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
            draft_proposal_deadline: moment().subtract(11, 'days'),
            final_proposal_deadline: moment().subtract(10, 'days'),
            candidature_deadline: moment().subtract(10, 'days'),
            booklet_publication_deadline: moment().subtract(11, 'days'),
            updated_booklet_publication_deadline: moment().subtract(10, 'days'),
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
            draft_proposal_deadline: moment().subtract(4, 'days'),
            final_proposal_deadline: moment().subtract(3, 'days'),
            candidature_deadline: moment().subtract(3, 'days'),
            booklet_publication_deadline: moment().subtract(4, 'days'),
            updated_booklet_publication_deadline: moment().subtract(3, 'days'),
            starts: moment().subtract(2, 'days'),
            ends: moment().subtract(1, 'days'),
            status: 'published'
        });

        const res = await request({
            path: '/events/latest-agora',
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
            draft_proposal_deadline: moment().subtract(11, 'days'),
            final_proposal_deadline: moment().subtract(10, 'days'),
            candidature_deadline: moment().subtract(10, 'days'),
            booklet_publication_deadline: moment().subtract(11, 'days'),
            updated_booklet_publication_deadline: moment().subtract(10, 'days'),
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
            draft_proposal_deadline: moment().subtract(4, 'days'),
            final_proposal_deadline: moment().subtract(3, 'days'),
            candidature_deadline: moment().subtract(3, 'days'),
            booklet_publication_deadline: moment().subtract(4, 'days'),
            updated_booklet_publication_deadline: moment().subtract(3, 'days'),
            starts: moment().subtract(2, 'days'),
            ends: moment().subtract(1, 'days'),
            status: 'published'
        });

        const res = await request({
            path: '/events/latest-epm',
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
            draft_proposal_deadline: moment().subtract(11, 'days'),
            final_proposal_deadline: moment().subtract(10, 'days'),
            candidature_deadline: moment().subtract(10, 'days'),
            booklet_publication_deadline: moment().subtract(11, 'days'),
            updated_booklet_publication_deadline: moment().subtract(10, 'days'),
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
            draft_proposal_deadline: moment().subtract(4, 'days'),
            final_proposal_deadline: moment().subtract(3, 'days'),
            candidature_deadline: moment().subtract(3, 'days'),
            booklet_publication_deadline: moment().subtract(4, 'days'),
            updated_booklet_publication_deadline: moment().subtract(3, 'days'),
            starts: moment().subtract(2, 'days'),
            ends: moment().subtract(1, 'days'),
            status: 'published'
        });

        const res = await request({
            path: '/events/latest-spm',
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
            draft_proposal_deadline: moment().subtract(4, 'days'),
            final_proposal_deadline: moment().subtract(3, 'days'),
            candidature_deadline: moment().subtract(3, 'days'),
            booklet_publication_deadline: moment().subtract(4, 'days'),
            updated_booklet_publication_deadline: moment().subtract(3, 'days'),
            starts: moment().subtract(2, 'days'),
            ends: moment().subtract(1, 'days'),
            status: 'draft'
        });

        const res = await request({
            path: '/events/latest',
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
            draft_proposal_deadline: moment().subtract(4, 'days'),
            final_proposal_deadline: moment().subtract(3, 'days'),
            candidature_deadline: moment().subtract(3, 'days'),
            booklet_publication_deadline: moment().subtract(4, 'days'),
            updated_booklet_publication_deadline: moment().subtract(3, 'days'),
            starts: moment().subtract(2, 'days'),
            ends: moment().subtract(1, 'days'),
            status: 'draft'
        });

        const res = await request({
            path: '/events/latest-agora',
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
            draft_proposal_deadline: moment().subtract(4, 'days'),
            final_proposal_deadline: moment().subtract(3, 'days'),
            candidature_deadline: moment().subtract(3, 'days'),
            booklet_publication_deadline: moment().subtract(4, 'days'),
            updated_booklet_publication_deadline: moment().subtract(3, 'days'),
            starts: moment().subtract(2, 'days'),
            ends: moment().subtract(1, 'days'),
            status: 'draft'
        });

        const res = await request({
            path: '/events/latest-epm',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
    });

    describe('finding the event', () => {
        // The events of these tests have the fixed dates: the clock stands before all of
        // them, unless a test sets it itself.
        beforeEach(() => {
            tk.freeze(BEFORE_EVERYTHING);
        });

        test.each(['test-slug', 'TEST-SLUG', 'Test-Slug'])('should find the event with the url test-slug as %s', async (url) => {
            const event = await generator.createEvent({ url: 'test-slug' });
            await generator.createEvent({ url: 'another-slug' });

            const res = await request({
                path: '/events/' + url,
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.id).toEqual(event.id);
            expect(res.body.data.url).toEqual('test-slug');
        });

        test('should not find an event by a part of its url', async () => {
            await generator.createEvent({ url: 'test-slug' });

            const res = await request({
                path: '/events/test',
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(404);
            expect(res.body.message).toEqual(NOT_FOUND);
        });

        // The four names pick the published event that starts last, not the one created last.
        const latest = [
            ['latest', ['agora', 'epm', 'spm']],
            ['latest-agora', ['agora']],
            ['latest-epm', ['epm']],
            ['latest-spm', ['spm']]
        ];

        test.each(latest)('should answer 404 on /events/%s when there is no event', async (name) => {
            const res = await request({
                path: '/events/' + name,
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(404);
            expect(res.body.message).toEqual(NOT_FOUND);
        });

        test.each(latest)('should answer on /events/%s with the published event that starts last', async (name, types) => {
            const type = types[0];
            const otherType = type === 'agora' ? 'epm' : 'agora';
            const lastStart = { starts: at('starts', 86400000), ends: at('ends', 86400000) };

            // Created first, but it starts last.
            const expected = await generator.createEvent({ type, ...fixedDates(lastStart) });
            await generator.createEvent({ type, ...fixedDates() });
            // Later still, but a draft, or (for the names with a type) of another type.
            await generator.createEvent({ type, status: 'draft', ...fixedDates({ starts: at('starts', 2 * 86400000), ends: at('ends', 2 * 86400000) }) });
            const later = await generator.createEvent({
                type: otherType,
                ...fixedDates({ starts: at('starts', 3 * 86400000), ends: at('ends', 3 * 86400000) })
            });

            // The caller manages the events, so the draft is visible to them: it is still not the latest.
            mock.mockAll({ mainPermissions: { permissions: ['global:manage_event:' + type] } });

            const res = await request({
                path: '/events/' + name,
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.id).toEqual(name === 'latest' ? later.id : expected.id);
        });

        test('should answer 404 on /events/latest-spm when the only SPM is a draft', async () => {
            await generator.createEvent({ type: 'spm', status: 'draft' });
            mock.mockAll({ mainPermissions: { permissions: ['global:manage_event:spm'] } });

            const res = await request({
                path: '/events/latest-spm',
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(404);
            expect(res.body.message).toEqual(NOT_FOUND);
        });

        test.each(['LATEST', 'latest-conference'])('should read /events/%s as a url, not as one of the four names', async (name) => {
            await generator.createEvent({ type: 'agora' });

            const res = await request({
                path: '/events/' + name,
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(404);
            expect(res.body.message).toEqual(NOT_FOUND);
        });
    });

    describe('what the event looks like', () => {
        // The events of these tests have the fixed dates: the clock stands before all of
        // them, unless a test sets it itself.
        beforeEach(() => {
            tk.freeze(BEFORE_EVERYTHING);
        });

        test('should answer with the event, no image and the permissions of the caller', async () => {
            tk.freeze(BEFORE_EVERYTHING);
            const event = await generator.createEvent({ type: 'agora', ...fixedDates() });

            const res = await request({
                path: '/events/' + event.id,
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({
                id: event.id,
                name: event.name,
                url: event.url,
                type: 'agora',
                status: 'published',
                body_id: event.body_id,
                starts: at('starts').toISOString(),
                ends: at('ends').toISOString(),
                application_period_starts: at('application_period_starts').toISOString(),
                application_period_ends: at('application_period_ends').toISOString(),
                board_approve_deadline: at('board_approve_deadline').toISOString(),
                participants_list_publish_deadline: at('participants_list_publish_deadline').toISOString(),
                memberslist_submission_deadline: at('memberslist_submission_deadline').toISOString(),
                application_status_revealed_at: null,
                image_id: null,
                image: null
            });
            expect(res.body.data).toHaveProperty('permissions');
            expect(res.body.data).not.toHaveProperty('applications');
        });

        test('should give an anonymous caller the same event as a member', async () => {
            tk.freeze(BEFORE_EVERYTHING);
            const event = await generator.createEvent({ type: 'agora', ...fixedDates() });

            memberWith([]);
            const asMember = await request({
                path: '/events/' + event.id,
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            anonymous();
            const asAnonymous = await request({ path: '/events/' + event.id, method: 'GET' });

            expect(asAnonymous.statusCode).toEqual(200);
            expect({ ...asAnonymous.body.data, permissions: null }).toEqual({ ...asMember.body.data, permissions: null });
        });
    });

    // The permissions object tells the frontend what to show. Every test is outside of the
    // periods of the event unless it says otherwise, so only the caller decides the values.
    describe('permissions', () => {
        // The events of these tests have the fixed dates: the clock stands before all of
        // them, unless a test sets it itself.
        beforeEach(() => {
            tk.freeze(BEFORE_EVERYTHING);
        });

        let event;

        beforeEach(async () => {
            event = await generator.createEvent({ type: 'agora', ...fixedDates() });
            tk.freeze(BEFORE_EVERYTHING);
        });

        const getPermissions = async (headers = { 'X-Auth-Token': 'blablabla' }) => {
            const res = await request({ path: '/events/' + event.id, method: 'GET', headers });
            expect(res.statusCode).toEqual(200);
            return res.body.data.permissions;
        };

        test('should all be false for an anonymous caller, without a value per body', async () => {
            anonymous();

            expect(await getPermissions({})).toEqual(permissionsOf({}, []));
        });

        // These two follow the dates of the event and not the caller, so they are true for an
        // anonymous caller too; applying itself needs a session.
        test('should tell an anonymous caller that the application period is open', async () => {
            anonymous();
            tk.freeze(at('application_period_starts'));

            expect(await getPermissions({})).toEqual(permissionsOf({ apply: true }, []));
        });

        test('should tell an anonymous caller that the participants list is public', async () => {
            anonymous();
            tk.freeze(at('participants_list_publish_deadline', 1));

            expect(await getPermissions({})).toEqual(permissionsOf({ see_participants_list: true }, []));
        });

        test('should all be false for a member without permissions, but for the body that may send participants', async () => {
            memberWith([]);

            expect(await getPermissions()).toEqual(permissionsOf());
        });

        test('should let a member without permissions apply in the application period only', async () => {
            memberWith([]);
            tk.freeze(at('application_period_ends'));

            expect(await getPermissions()).toEqual(permissionsOf({ apply: true }));
        });

        test('should let a board member see the board view and the memberslist of their local, outside of the periods', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });

            expect(await getPermissions()).toEqual(permissionsOf({
                see_boardview: { [LOCAL]: true },
                see_memberslist: { [LOCAL]: true }
            }));
        });

        test('should let a board member approve members and upload the memberslist of their local in the application period', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            tk.freeze(at('application_period_starts'));

            expect(await getPermissions()).toEqual(permissionsOf({
                apply: true,
                set_board_comment_and_participant_type: { [LOCAL]: true },
                see_boardview: { [LOCAL]: true },
                upload_memberslist: { [LOCAL]: true },
                edit_memberslist: { [LOCAL]: true },
                see_memberslist: { [LOCAL]: true }
            }));
        });

        // A member who is in a board of the body that is not a local: only the boards of
        // locals handle a memberslist.
        test('should not give the memberslist of a body that is not a local to its board', async () => {
            mock.cleanAll();
            mock.mockCore({});
            mock.mockCoreMainPermissions({ noPermissions: true });
            // Core names the other body for both questions: who approves members, who manages the memberslist.
            nock(`${config.core.url}:${config.core.port}`)
                .persist()
                .post('/my_permissions')
                .reply(200, { success: true, data: [{ body_id: OTHER_BODY }] });
            tk.freeze(at('application_period_starts'));

            expect(await getPermissions()).toEqual(permissionsOf({
                apply: true,
                set_board_comment_and_participant_type: { [OTHER_BODY]: true },
                see_boardview: { [OTHER_BODY]: true }
            }));
        });

        const everyType = { agora: true, epm: false, spm: false };

        test.each([
            ['global:manage_event:agora', {
                create_event: everyType,
                edit_pax_limits: everyType,
                edit_event: true,
                change_event_status: true,
                delete_event: true
            }],
            ['global:manage_applications:agora', {
                apply: true,
                manage_applications: true,
                see_applications: true,
                see_applications_juridical: true,
                see_applications_incoming: true,
                see_applications_network: true,
                see_participants_list: true,
                export: { openslides: true, all: true, incoming: true }
            }],
            ['global:apply:agora', { apply: true }],
            ['global:manage_incoming:agora', {
                manage_incoming: true,
                see_applications_incoming: true,
                export: { openslides: true, incoming: true }
            }],
            ['global:manage_juridical:agora', {
                manage_juridical: true,
                see_applications_juridical: true,
                export: { delegates_jc: true }
            }],
            ['global:update_memberslist_status:agora', { see_applications_network: true }],
            ['global:approve_members:agora', {
                set_board_comment_and_participant_type: { global: true },
                see_boardview: { global: true }
            }],
            ['global:use_massmailer:agora', { use_massmailer: true }],
            ['global:manage_memberslist:agora', {
                upload_memberslist: { global: true },
                edit_memberslist: { global: true },
                see_memberslist: { global: true }
            }],
            ['global:see_memberslists:agora', { see_memberslist: { global: true } }],
            ['global:see_missing_memberslists:agora', { see_missing_memberslist: { global: true } }],
            ['global:see_memberslists_without_fee:agora', { see_memberslist_without_fee: { global: true } }],
            ['global:set_memberslists_fee_paid:agora', { set_memberslists_fee_paid: true }],
            ['global:manage_candidates:agora', { manage_candidates: true }],
            ['global:manage_plenaries:agora', { manage_plenaries: true, see_plenaries: true }],
            ['global:see_plenaries:agora', { see_plenaries: true }],
            ['global:mark_attendance:agora', { mark_attendance: true }],
            ['global:manage_question_lines:agora', { manage_question_lines: true, see_questions: true }],
            ['global:see_question_lines:agora', { see_question_lines: true, see_questions: true }],
            ['global:see_background_tasks:statutory', { see_background_tasks: true }]
        ])('should give the holder of %s alone exactly what it stands for', async (permission, expected) => {
            memberWith([permission]);

            expect(await getPermissions()).toEqual(permissionsOf(expected));
        });

        // Managing the events of another type only shows in the two values that are per type.
        test('should give the holder of the permissions for the other types nothing on this event', async () => {
            memberWith([
                'global:manage_event:epm',
                'global:manage_applications:epm',
                'global:manage_incoming:spm',
                'global:approve_members:epm',
                'global:manage_memberslist:spm',
                'global:manage_question_lines:epm'
            ]);

            expect(await getPermissions()).toEqual(permissionsOf({
                create_event: { epm: true },
                edit_pax_limits: { epm: true }
            }));
        });

        test('should let a member with a confirmed application see and submit questions', async () => {
            memberWith([]);
            await generator.createApplication({ user_id: regularUser.id, body_id: LOCAL, confirmed: true }, event);

            expect(await getPermissions()).toEqual(permissionsOf({ see_questions: true, submit_questions: true }));
        });

        test('should not let a member whose application is not confirmed see or submit questions', async () => {
            memberWith([]);
            await generator.createApplication({ user_id: regularUser.id, body_id: LOCAL, confirmed: false }, event);

            expect(await getPermissions()).toEqual(permissionsOf());
        });
    });

    // The computed fields of an event, 1 ms before, exactly at and 1 ms after each end of
    // their periods. `permission` is what a board member of a local gets from the field.
    describe('periods', () => {
        // The events of these tests have the fixed dates: the clock stands before all of
        // them, unless a test sets it itself.
        beforeEach(() => {
            tk.freeze(BEFORE_EVERYTHING);
        });

        const periods = [
            {
                field: 'can_apply',
                from: 'application_period_starts',
                until: 'application_period_ends',
                permission: (permissions) => permissions.apply
            },
            {
                field: 'can_approve_members',
                from: 'application_period_starts',
                until: 'board_approve_deadline',
                permission: (permissions) => permissions.set_board_comment_and_participant_type[LOCAL]
            },
            {
                field: 'can_upload_memberslist',
                from: 'application_period_starts',
                until: 'memberslist_submission_deadline',
                permission: (permissions) => permissions.upload_memberslist[LOCAL]
            },
            {
                field: 'can_edit_memberslist',
                from: 'application_period_starts',
                until: 'memberslist_edit_deadline'
            }
        ];

        const edges = periods.flatMap(({ field, from, until, permission }) => [
            [field, false, `1 ms before ${from}`, from, -1, permission],
            [field, true, `exactly at ${from} (inclusive)`, from, 0, permission],
            [field, true, `exactly at ${until} (inclusive)`, until, 0, permission],
            [field, false, `1 ms after ${until}`, until, 1, permission]
        ]).concat([
            ['can_see_participants_list', false, '1 ms before participants_list_publish_deadline', 'participants_list_publish_deadline', -1, (permissions) => permissions.see_participants_list],
            ['can_see_participants_list', false, 'exactly at participants_list_publish_deadline (exclusive)', 'participants_list_publish_deadline', 0, (permissions) => permissions.see_participants_list],
            ['can_see_participants_list', true, '1 ms after participants_list_publish_deadline', 'participants_list_publish_deadline', 1, (permissions) => permissions.see_participants_list]
        ]);

        test.each(edges)('%s should be %p %s', async (field, expected, description, date, offset, permission) => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const event = await generator.createEvent({ type: 'agora', ...fixedDates() });
            tk.freeze(at(date, offset));

            const res = await request({
                path: '/events/' + event.id,
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data[field]).toEqual(expected);
            if (permission) {
                expect(permission(res.body.data.permissions)).toEqual(expected);
            }
        });

        test('should give fourteen days before the start as memberslist_edit_deadline', async () => {
            const event = await generator.createEvent({ type: 'agora', ...fixedDates() });

            const res = await request({
                path: '/events/' + event.id,
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.body.data.memberslist_edit_deadline).toEqual(at('memberslist_edit_deadline').toISOString());
            expect(at('starts').getTime() - at('memberslist_edit_deadline').getTime()).toEqual(14 * 24 * 3600 * 1000);
        });

        // The fourteen days are days on the calendar of Central Europe: when the clocks go
        // forward in between, the deadline is at the same time of day, 14 days and 1 hour before.
        test('should count the fourteen days on the Central European calendar across the start of summer time', async () => {
            const event = await generator.createEvent({
                type: 'agora',
                ...fixedDates({
                    memberslist_submission_deadline: new Date('2030-03-04T09:00:00.000Z'),
                    // 10:00 in Central European summer time, which starts on 31 March 2030.
                    starts: new Date('2030-04-08T08:00:00.000Z'),
                    ends: new Date('2030-04-12T08:00:00.000Z')
                })
            });

            const res = await request({
                path: '/events/' + event.id,
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            // 10:00 in Central European (winter) time on 25 March.
            expect(res.body.data.memberslist_edit_deadline).toEqual('2030-03-25T09:00:00.000Z');
        });
    });
});
