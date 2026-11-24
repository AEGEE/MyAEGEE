const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const constants = require('../../lib/constants');
const user = require('../assets/oms-core-valid.json').data;

const unauthorizedMocks = {
    core: { unauthorized: true },
    mainPermissions: { unauthorized: true },
    approvePermissions: { unauthorized: true }
};

// Query parameters take dates as YYYY-MM-DD.
const dateOnly = (date) => date.toISOString().slice(0, 10);
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

    describe('GET /', () => {
        test('should list published events without authentication', async () => {
            mock.mockAll(unauthorizedMocks);
            const event = await generator.createEvent();

            const res = await request({ path: '/', method: 'GET' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body.data.length).toEqual(1);
            expect(res.body.data[0].id).toEqual(event.id);
        });

        test('should not list unpublished or deleted events', async () => {
            await generator.createEvent({ published: 'none' });
            await generator.createEvent({ deleted: true });
            const visible = await generator.createEvent({ published: 'minimal', status: 'first approval' });

            const res = await request({ path: '/', method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.map((e) => e.id)).toEqual([visible.id]);
        });

        test('should only return the minimal fields for minimally published events', async () => {
            await generator.createEvent({ published: 'minimal', status: 'first approval' });

            const res = await request({ path: '/', method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.statusCode).toEqual(200);
            expect(Object.keys(res.body.data[0]).sort()).toEqual([...constants.EVENT_MINIMAL_FIELDS].sort());
        });

        test('should only return the full public fields for fully published events', async () => {
            await generator.createEvent({ published: 'full' });

            const res = await request({ path: '/', method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.statusCode).toEqual(200);
            expect(Object.keys(res.body.data[0]).sort()).toEqual([...constants.EVENT_FULL_FIELDS].sort());
            expect(res.body.data[0]).not.toHaveProperty('organizers');
            expect(res.body.data[0]).not.toHaveProperty('budget');
            expect(res.body.data[0]).not.toHaveProperty('programme_suct');
            expect(res.body.data[0].application_status).toEqual('open');
            expect(res.body.data[0].available_spots).toEqual(res.body.data[0].max_participants);
        });

        test('should sort the events by start date ascending', async () => {
            const later = await generator.createEvent({ starts: generator.daysFromNow(80) });
            const earlier = await generator.createEvent({ starts: generator.daysFromNow(40) });

            const res = await request({ path: '/', method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.body.data.map((e) => e.id)).toEqual([earlier.id, later.id]);
        });

        test('should search by name case-insensitively', async () => {
            const event = await generator.createEvent({ name: 'Sunny Beach Party' });
            await generator.createEvent({ name: 'Mountain hike', description: 'Lots of walking' });

            const res = await request({ path: '/', method: 'GET', query: { search: 'beach' }, headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.map((e) => e.id)).toEqual([event.id]);
        });

        test('should search by description', async () => {
            const event = await generator.createEvent({ name: 'SU', description: 'We will learn to sail' });
            await generator.createEvent({ name: 'Other', description: 'Something else' });

            const res = await request({ path: '/', method: 'GET', query: { search: 'SAIL' }, headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.body.data.map((e) => e.id)).toEqual([event.id]);
        });

        // lib/query-boolean.js turns 'true'/'false' query values into booleans before the
        // handlers run. No summeruniversity handler branches on a genuinely boolean query
        // parameter, so these tests pin the parser's observable effect on `search`.
        test('should treat ?search=false as boolean false (no search filter applied)', async () => {
            await generator.createEvent({ name: 'Something false here' });
            await generator.createEvent({ name: 'Another one', description: 'Nothing to see' });

            const res = await request({ path: '/', method: 'GET', query: { search: 'false' }, headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.length).toEqual(2);
        });

        test('should treat ?search=true as boolean true (searching for the stringified value)', async () => {
            const event = await generator.createEvent({ name: 'A true story' });
            await generator.createEvent({ name: 'Another one', description: 'Nothing to see' });

            const res = await request({ path: '/', method: 'GET', query: { search: 'true' }, headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.map((e) => e.id)).toEqual([event.id]);
        });

        test('should filter by a single type', async () => {
            const pilot = await generator.createEvent({ type: 'pilot' });
            await generator.createEvent({ type: 'regular' });

            const res = await request({ path: '/', method: 'GET', query: { type: 'pilot' }, headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.body.data.map((e) => e.id)).toEqual([pilot.id]);
        });

        test('should parse bracketed array parameters as sent by the frontend', async () => {
            const pilot = await generator.createEvent({ type: 'pilot' });
            await generator.createEvent({ type: 'regular' });

            const res = await request({ path: '/?type[]=pilot', method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.map((e) => e.id)).toEqual([pilot.id]);
        });

        test('should keep bracketed parameters with more than 20 items as an array', async () => {
            const pilot = await generator.createEvent({ type: 'pilot' });
            await generator.createEvent({ type: 'regular' });

            const query = Array.from({ length: 25 }, () => 'type[]=pilot').join('&');
            const res = await request({ path: '/?' + query, method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.map((e) => e.id)).toEqual([pilot.id]);
        });

        test('should filter by multiple types', async () => {
            await generator.createEvent({ type: 'pilot' });
            await generator.createEvent({ type: 'regular' });

            const res = await request({ path: '/', method: 'GET', query: { type: ['pilot', 'regular'] }, headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.body.data.length).toEqual(2);
        });

        test('should filter by season', async () => {
            const old = await generator.createEvent({ season: 2025 });
            await generator.createEvent({ season: 2026 });

            const res = await request({ path: '/', method: 'GET', query: { season: '2025' }, headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.body.data.map((e) => e.id)).toEqual([old.id]);
        });

        test('should filter by start and end dates', async () => {
            const inside = await generator.createEvent({ starts: generator.daysFromNow(104), ends: generator.daysFromNow(114) });
            await generator.createEvent({ starts: generator.daysFromNow(70), ends: generator.daysFromNow(79) }); // starts before
            await generator.createEvent({ starts: generator.daysFromNow(124), ends: generator.daysFromNow(140) }); // ends after

            const res = await request({
                path: '/',
                method: 'GET',
                query: { starts: dateOnly(generator.daysFromNow(100)), ends: dateOnly(generator.daysFromNow(130)) },
                headers: { 'X-Auth-Token': 'foobar' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.map((e) => e.id)).toEqual([inside.id]);
        });

        test('should filter by application status', async () => {
            const open = await generator.createEvent();
            const closed = await generator.createEvent({ application_starts: generator.daysFromNow(-20), application_ends: generator.daysFromNow(-10) });

            const openRes = await request({ path: '/', method: 'GET', query: { application_status: 'open' }, headers: { 'X-Auth-Token': 'foobar' } });
            expect(openRes.body.data.map((e) => e.id)).toEqual([open.id]);

            const closedRes = await request({ path: '/', method: 'GET', query: { application_status: 'closed' }, headers: { 'X-Auth-Token': 'foobar' } });
            expect(closedRes.body.data.map((e) => e.id)).toEqual([closed.id]);
        });

        test('should consider an event with an open call as open for applications', async () => {
            const event = await generator.createEvent({
                application_starts: generator.daysFromNow(-20),
                application_ends: generator.daysFromNow(-10),
                open_call: true
            });

            const res = await request({ path: '/', method: 'GET', query: { application_status: 'open' }, headers: { 'X-Auth-Token': 'foobar' } });
            expect(res.body.data.map((e) => e.id)).toEqual([event.id]);
        });

        test('should respect offset and limit', async () => {
            const events = [];
            for (let i = 1; i <= 5; i++) {
                events.push(await generator.createEvent({ starts: generator.daysFromNow(40 + i) }));
            }

            const res = await request({ path: '/', method: 'GET', query: { offset: '1', limit: '2' }, headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.map((e) => e.id)).toEqual([events[1].id, events[2].id]);
            expect(res.body.meta).toEqual({ offset: 1, limit: 2 });
        });

        test('should ignore invalid offset and limit', async () => {
            await generator.createEvent();
            await generator.createEvent();

            const res = await request({ path: '/', method: 'GET', query: { offset: '-1', limit: 'abc' }, headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.length).toEqual(2);
            expect(res.body.meta).toEqual({});
        });
    });

    describe('GET /recents', () => {
        test('should return 401 if the user is not authenticated', async () => {
            mock.mockAll(unauthorizedMocks);

            const res = await request({ path: '/recents', method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.statusCode).toEqual(401);
            expect(res.body.success).toEqual(false);
            expect(res.body.message).toEqual('Error fetching data: user is not authenticated.');
        });

        test('should return the latest end date per organizing bodies combination', async () => {
            const bodies = [{ body_id: 1, body_name: 'AEGEE-Dresden' }];
            await generator.createEvent({ organizing_bodies: bodies, starts: generator.daysFromNow(100), ends: generator.daysFromNow(110) });
            const latest = await generator.createEvent({ organizing_bodies: bodies, starts: generator.daysFromNow(130), ends: generator.daysFromNow(140) });
            await generator.createEvent({ starts: generator.daysFromNow(70), ends: generator.daysFromNow(80) });
            await generator.createEvent({ organizing_bodies: bodies, published: 'minimal', status: 'first approval', starts: generator.daysFromNow(160), ends: generator.daysFromNow(170) });

            const res = await request({ path: '/recents', method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body.data.length).toEqual(2);

            const dresden = res.body.data.find((e) => e.organizing_bodies[0].body_id === 1);
            expect(new Date(dresden.latest_event).toISOString()).toEqual(new Date(latest.ends).toISOString());
        });

        test('should filter by end date', async () => {
            const bodies = [{ body_id: 1, body_name: 'AEGEE-Dresden' }];
            const earlier = await generator.createEvent({ organizing_bodies: bodies, starts: generator.daysFromNow(100), ends: generator.daysFromNow(110) });
            await generator.createEvent({ organizing_bodies: bodies, starts: generator.daysFromNow(130), ends: generator.daysFromNow(140) });

            const res = await request({ path: '/recents', method: 'GET', query: { ends: dateOnly(generator.daysFromNow(125)) }, headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.length).toEqual(1);
            expect(new Date(res.body.data[0].latest_event).toISOString()).toEqual(new Date(earlier.ends).toISOString());
        });
    });

    describe('GET /mine/organizing', () => {
        test('should return 401 if the user is not authenticated', async () => {
            mock.mockAll(unauthorizedMocks);

            const res = await request({ path: '/mine/organizing', method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.statusCode).toEqual(401);
        });

        test('should list the events the user organizes, including unpublished ones', async () => {
            const published = await generator.createEvent();
            const unpublished = await generator.createEvent({ published: 'none', status: 'first draft' });
            await generator.createEvent({ deleted: true });
            await generator.createEvent({ organizers: generator.generateOrganizers(9999) });

            const res = await request({ path: '/mine/organizing', method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body.data.map((e) => e.id).sort()).toEqual([published.id, unpublished.id].sort());
            expect(res.body.data[0]).toHaveProperty('organizers');
        });

        test('should apply the default query filters', async () => {
            const event = await generator.createEvent({ name: 'Findable' });
            await generator.createEvent({ name: 'Other' });

            const res = await request({ path: '/mine/organizing', method: 'GET', query: { search: 'findable' }, headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.body.data.map((e) => e.id)).toEqual([event.id]);
        });
    });

    describe('GET /mine/participating', () => {
        test('should return 401 if the user is not authenticated', async () => {
            mock.mockAll(unauthorizedMocks);

            const res = await request({ path: '/mine/participating', method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.statusCode).toEqual(401);
        });

        test('should list the events the user applied to, with the application status', async () => {
            const applied = await generator.createEvent();
            const notApplied = await generator.createEvent();
            const deleted = await generator.createEvent({ deleted: true });
            await generator.createApplication(applied, { user_id: user.id, status: 'accepted' });
            await generator.createApplication(notApplied, { user_id: 9999 });
            await generator.createApplication(deleted, { user_id: user.id });

            const res = await request({ path: '/mine/participating', method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body.data.length).toEqual(1);
            expect(res.body.data[0].id).toEqual(applied.id);
            expect(res.body.data[0].applications).toEqual([{ user_id: user.id, status: 'accepted' }]);
        });
    });

    describe('GET /mine/approvable', () => {
        test('should return 401 if the user is not authenticated', async () => {
            mock.mockAll(unauthorizedMocks);

            const res = await request({ path: '/mine/approvable', method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.statusCode).toEqual(401);
        });

        test('should list all non-deleted events of all types for a user who can approve everything', async () => {
            const regular = await generator.createEvent({ type: 'regular', published: 'none', status: 'first submission' });
            const pilot = await generator.createEvent({ type: 'pilot' });
            await generator.createEvent({ deleted: true });

            const res = await request({ path: '/mine/approvable', method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.map((e) => e.id).sort()).toEqual([regular.id, pilot.id].sort());
        });

        test('should only list events of the types the user can approve', async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:approve_summeruniversity:pilot'] } });
            await generator.createEvent({ type: 'regular' });
            const pilot = await generator.createEvent({ type: 'pilot' });

            const res = await request({ path: '/mine/approvable', method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.map((e) => e.id)).toEqual([pilot.id]);
        });

        test('should return nothing if the user cannot approve anything', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            await generator.createEvent();

            const res = await request({ path: '/mine/approvable', method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toEqual([]);
        });
    });
    describe('invalid filters', () => {
        const getPath = (path) => request({ path, method: 'GET', headers: { 'X-Auth-Token': 'foobar' } });

        test.each([
            '/?type=foo',
            '/?type[a]=regular',
            '/?season=abc',
            '/?season=2026.5',
            '/?starts=garbage',
            '/?ends=2020-13-45',
            '/?application_status=true',
            '/?application_status=maybe',
            '/?application_status[]=open&application_status[]=maybe',
            '/mine/organizing?season=abc',
            '/mine/participating?type=foo',
            '/recents?ends=garbage',
            // A year outside 1000-9999 reached Postgres, which refused the date with a 500.
            '/?starts=0001-01-01',
            '/?ends=0999-12-31',
            '/mine/organizing?starts=0001-01-01',
            '/mine/participating?ends=0001-01-01'
        ])('should return 422 for %s', async (path) => {
            await generator.createEvent();

            const res = await getPath(path);

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(res.body).toHaveProperty('message');
        });

        test.each([
            '/?type=pilot',
            '/?type[]=regular&type[]=pilot',
            '/?season=2026',
            '/?starts=2020-01-01&ends=2040-12-31',
            '/?starts=1000-01-01&ends=9999-12-31',
            '/?application_status=open',
            '/?application_status[]=open&application_status[]=closed',
            '/recents?ends=2040-12-31T10:00:00.000Z'
        ])('should accept %s', async (path) => {
            const res = await getPath(path);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
        });

        // Other sites call the lists with empty filters; an empty value is no filter.
        test.each([
            '/?type=',
            '/?season=',
            '/?starts=&ends=',
            '/?application_status=',
            '/mine/organizing?season=',
            '/mine/participating?type=',
            '/recents?ends='
        ])('should treat the empty filters of %s as absent', async (path) => {
            await generator.createEvent();

            const res = await getPath(path);
            const unfiltered = await getPath(path.split('?')[0]);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toEqual(unfiltered.body.data);
        });
    });
});
