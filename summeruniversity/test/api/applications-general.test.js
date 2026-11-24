const xlsx = require('node-xlsx').default;

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const constants = require('../../lib/constants');

const unauthorizedMocks = {
    core: { unauthorized: true },
    mainPermissions: { unauthorized: true },
    approvePermissions: { unauthorized: true }
};

describe('Cross-event application endpoints', () => {
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

    const get = (path, query, options = {}) => request({ path, method: 'GET', headers: { 'X-Auth-Token': 'foobar' }, query, ...options });

    describe('GET /boardview/:body_id', () => {
        test('should return 401 if the user is not authenticated', async () => {
            mock.mockAll(unauthorizedMocks);

            const res = await get('/boardview/34');

            expect(res.statusCode).toEqual(401);
        });

        test('should return 400 if the body id is not a number', async () => {
            const res = await get('/boardview/abc');

            expect(res.statusCode).toEqual(400);
            expect(res.body.message).toEqual('bodyId is not a number.');
        });

        test.each(['1.5', '99999999999'])('should list nothing for the body id %s, which no body has', async (bodyId) => {
            const event = await generator.createEvent();
            await generator.createApplication(event, { user_id: 10, body_id: 1 });

            const res = await get('/boardview/' + bodyId);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toEqual([]);
        });

        test('should return 403 without any boardview permission', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true }, approvePermissions: { noPermissions: true } });

            const res = await get('/boardview/34');

            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toEqual('You are not allowed to see this');
        });

        test('should return 403 for a body the user is not board of', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });

            const res = await get('/boardview/1');

            expect(res.statusCode).toEqual(403);
        });

        test('should list the applications of the body with their events for a board member', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const event = await generator.createEvent({ name: 'Boardview SU' });
            const application = await generator.createApplication(event, { user_id: 10, body_id: 34 });
            await generator.createApplication(event, { user_id: 11, body_id: 1 });

            const res = await get('/boardview/34');

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body.data.length).toEqual(1);
            expect(res.body.data[0].id).toEqual(application.id);
            expect(res.body.data[0].event.name).toEqual('Boardview SU');
        });

        test('should return only the fields of the event a board needs', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });
            const event = await generator.createEvent({
                name: 'Boardview SU',
                budget: 'https://example.org/budget',
                programme_suct: 'https://example.org/programme',
                organizers: generator.generateOrganizers(9999)
            });
            await generator.createApplication(event, { user_id: 10, body_id: 34 });

            const res = await get('/boardview/34');

            expect(res.statusCode).toEqual(200);
            const returned = res.body.data[0].event;
            expect(returned.id).toEqual(event.id);
            expect(returned.name).toEqual('Boardview SU');
            expect(returned.url).toEqual(event.url);
            expect(returned.questions).toEqual(event.questions);
            for (const field of ['budget', 'programme_suct', 'organizers', 'deleted', 'status']) {
                expect(returned).not.toHaveProperty(field);
            }
            const allowed = [...constants.EVENT_MINIMAL_FIELDS, 'questions'];
            expect(Object.keys(returned).filter((field) => !allowed.includes(field))).toEqual([]);
        });

        test('should list the applications of any body with the global permission', async () => {
            mock.mockAll({ approvePermissions: { noPermissions: true } });
            const event = await generator.createEvent();
            await generator.createApplication(event, { user_id: 10, body_id: 1 });

            const res = await get('/boardview/1');

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.length).toEqual(1);
        });
    });

    describe('GET /applications/future/:user_id', () => {
        test('should return 401 if the user is not authenticated', async () => {
            mock.mockAll(unauthorizedMocks);

            const res = await get('/applications/future/10');

            expect(res.statusCode).toEqual(401);
        });

        test('should return 403 without the required permissions', async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:approve_summeruniversity:regular'] } });

            const res = await get('/applications/future/10');

            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toEqual('You are not allowed to see future applications.');
        });

        test('should return 400 if the user id is not a number', async () => {
            const res = await get('/applications/future/abc');

            expect(res.statusCode).toEqual(400);
            expect(res.body.message).toEqual('User ID should be a number.');
        });

        test('should return 400 if the user id is not an integer', async () => {
            const res = await get('/applications/future/1.5');

            expect(res.statusCode).toEqual(400);
            expect(res.body.message).toEqual('User ID should be a number.');
        });

        test('should return 400 if the user id is above the maximum ID', async () => {
            const res = await get('/applications/future/2147483648');

            expect(res.statusCode).toEqual(400);
            expect(res.body.message).toEqual('User ID should be a number.');
        });

        test('should list the active future applications of the user for a manager', async () => {
            const later = await generator.createEvent({ name: 'Later', starts: generator.daysFromNow(90) });
            const sooner = await generator.createEvent({ name: 'Sooner', starts: generator.daysFromNow(45) });
            const past = await generator.createEvent({
                application_starts: generator.daysFromNow(-40),
                application_ends: generator.daysFromNow(-30),
                starts: generator.daysFromNow(-20)
            });
            const deleted = await generator.createEvent({ deleted: true });
            const rejectedEvent = await generator.createEvent();
            const cancelledEvent = await generator.createEvent();

            const laterApplication = await generator.createApplication(later, { user_id: 10, status: 'accepted' });
            const soonerApplication = await generator.createApplication(sooner, { user_id: 10 });
            await generator.createApplication(past, { user_id: 10 });
            await generator.createApplication(deleted, { user_id: 10 });
            await generator.createApplication(rejectedEvent, { user_id: 10, status: 'rejected' });
            await generator.createApplication(cancelledEvent, { user_id: 10, cancelled: true });
            await generator.createApplication(later, { user_id: 11 });

            const res = await get('/applications/future/10');

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body.data).toEqual([
                {
                    service: 'summeruniversity',
                    application_id: soonerApplication.id,
                    application_status: 'pending',
                    event_id: sooner.id,
                    event_name: 'Sooner',
                    event_type: 'regular',
                    event_starts: sooner.starts.toISOString()
                },
                {
                    service: 'summeruniversity',
                    application_id: laterApplication.id,
                    application_status: 'accepted',
                    event_id: later.id,
                    event_name: 'Later',
                    event_type: 'regular',
                    event_starts: later.starts.toISOString()
                }
            ]);
        });

        test('should allow users who can update application bans', async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:update_application_ban:member'] } });

            const res = await get('/applications/future/10');

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toEqual([]);
        });

        test('should allow a manager of pilot Summer Universities only', async () => {
            mock.mockAll({
                core: { notSuperadmin: true },
                mainPermissions: { permissions: ['global:manage_summeruniversity:pilot'] },
                approvePermissions: { noPermissions: true }
            });
            const event = await generator.createEvent();
            await generator.createApplication(event, { user_id: 10 });

            const res = await get('/applications/future/10');

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.map((application) => application.event_id)).toEqual([event.id]);
        });
    });

    describe('GET /applications', () => {
        test('should return 401 if the user is not authenticated', async () => {
            mock.mockAll(unauthorizedMocks);

            const res = await get('/applications');

            expect(res.statusCode).toEqual(401);
        });

        test('should return the application statistics', async () => {
            const first = await generator.createEvent({ name: 'First SU' });
            const second = await generator.createEvent({ name: 'Second SU' });
            await generator.createApplication(first, { user_id: 10, body_name: 'AEGEE-Alicante', nationality: 'Spain', confirmed: true });
            await generator.createApplication(second, { user_id: 10, body_name: 'AEGEE-Alicante', nationality: 'Spain' });
            await generator.createApplication(first, { user_id: 11, body_name: 'AEGEE-Dresden', nationality: 'Germany' });

            const res = await get('/applications');

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body.data.by_event).toEqual(expect.arrayContaining([
                { type: 'First SU', value: 2 },
                { type: 'Second SU', value: 1 }
            ]));
            expect(res.body.data.by_body).toEqual(expect.arrayContaining([
                { type: 'AEGEE-Alicante', value: 1 },
                { type: 'AEGEE-Dresden', value: 1 }
            ]));
            expect(res.body.data.by_nationality).toEqual(expect.arrayContaining([
                { type: 'Spain', value: 1 },
                { type: 'Germany', value: 1 }
            ]));
            expect(res.body.data.by_status).toEqual([
                { type: 'total_applications', value: 3 },
                { type: 'total_members', value: 2 },
                { type: 'confirmed', value: 1 }
            ]);
        });

        test('should filter the statistics by season', async () => {
            const current = await generator.createEvent({ name: 'Current SU', season: 2026 });
            const old = await generator.createEvent({ name: 'Old SU', season: 2025 });
            await generator.createApplication(current, { user_id: 10 });
            await generator.createApplication(old, { user_id: 11 });
            await generator.createApplication(old, { user_id: 12 });

            const res = await get('/applications', { season: '2025' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.by_event).toEqual([{ type: 'Old SU', value: 2 }]);
            expect(res.body.data.by_status[0]).toEqual({ type: 'total_applications', value: 2 });
        });

        test('should return 400 if the season is not a year', async () => {
            const res = await get('/applications', { season: 'abc' });

            expect(res.statusCode).toEqual(400);
            expect(res.body.success).toEqual(false);
            expect(res.body.message).toEqual('Season should be a year.');
        });

        test.each([
            ['not a whole number', '2025.5'],
            ['zero', '0'],
            ['negative', '-2025'],
            ['not four digits', '20250'],
            ['in another notation', '2.025e3'],
            ['padded with spaces', ' 2025 '],
            ['a boolean', 'true'],
            ['given twice', ['2025', '2026']]
        ])('should return 400 if the season is %s', async (description, season) => {
            const res = await get('/applications', { season });

            expect(res.statusCode).toEqual(400);
            expect(res.body.message).toEqual('Season should be a year.');
        });

        test('should return all seasons for an empty season', async () => {
            const current = await generator.createEvent({ season: 2026 });
            const old = await generator.createEvent({ season: 2025 });
            await generator.createApplication(current, { user_id: 10 });
            await generator.createApplication(old, { user_id: 11 });

            const res = await get('/applications', { season: '' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.by_status[0]).toEqual({ type: 'total_applications', value: 2 });
        });

        test('should return empty statistics for a season without applications', async () => {
            const event = await generator.createEvent({ season: 2026 });
            await generator.createApplication(event, { user_id: 10 });

            const res = await get('/applications', { season: '2024' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.by_event).toEqual([]);
            expect(res.body.data.by_body).toEqual([]);
            expect(res.body.data.by_status[0]).toEqual({ type: 'total_applications', value: 0 });
        });

        test('should return 403 for an authenticated user without SU management or approval permissions', async () => {
            mock.mockAll({ core: { notSuperadmin: true }, mainPermissions: { noPermissions: true }, approvePermissions: { noPermissions: true } });

            const res = await get('/applications');

            expect(res.statusCode).toEqual(403);
            expect(res.body.success).toEqual(false);
        });

        test('should be visible to a user who can approve Summer Universities', async () => {
            mock.mockAll({
                core: { notSuperadmin: true },
                mainPermissions: { permissions: ['global:approve_summeruniversity:regular'] },
                approvePermissions: { noPermissions: true }
            });

            const res = await get('/applications');

            expect(res.statusCode).toEqual(200);
        });

        test('should be visible to a user who can manage Summer Universities', async () => {
            mock.mockAll({
                core: { notSuperadmin: true },
                mainPermissions: { permissions: ['global:manage_summeruniversity:regular'] },
                approvePermissions: { noPermissions: true }
            });

            const res = await get('/applications');

            expect(res.statusCode).toEqual(200);
        });

        test('should count rejected and cancelled applications in the totals', async () => {
            const event = await generator.createEvent();
            await generator.createApplication(event, { user_id: 10, status: 'rejected' });
            await generator.createApplication(event, { user_id: 11, cancelled: true });

            const res = await get('/applications');

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.by_status).toEqual([
                { type: 'total_applications', value: 2 },
                { type: 'total_members', value: 2 },
                { type: 'confirmed', value: 0 }
            ]);
        });

        test('should list two Summer Universities with the same name as two entries', async () => {
            const first = await generator.createEvent({ name: 'Same name' });
            const second = await generator.createEvent({ name: 'Same name' });
            await generator.createApplication(first, { user_id: 10 });
            await generator.createApplication(second, { user_id: 11 });

            const res = await get('/applications');

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.by_event).toEqual([
                { type: 'Same name', value: 1 },
                { type: 'Same name', value: 1 }
            ]);
        });

        test('should count an applicant of several seasons once, with one of their bodies', async () => {
            const old = await generator.createEvent({ season: 2025 });
            const current = await generator.createEvent({ season: 2026 });
            await generator.createApplication(old, { user_id: 10, body_name: 'AEGEE-Alicante' });
            await generator.createApplication(current, { user_id: 10, body_name: 'AEGEE-Dresden' });

            const res = await get('/applications');

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.by_body).toHaveLength(1);
            expect(res.body.data.by_body[0].value).toEqual(1);
            expect(['AEGEE-Alicante', 'AEGEE-Dresden']).toContain(res.body.data.by_body[0].type);
        });
    });
    describe('GET /applications/export', () => {
        const getExport = (query) => get('/applications/export', query, { responseType: 'buffer' });

        test('should return 401 if the user is not authenticated', async () => {
            mock.mockAll(unauthorizedMocks);

            const res = await get('/applications/export', { season: '2026' });

            expect(res.statusCode).toEqual(401);
        });

        test('should return 403 for an authenticated user without SU management or approval permissions', async () => {
            mock.mockAll({ core: { notSuperadmin: true }, mainPermissions: { noPermissions: true }, approvePermissions: { noPermissions: true } });

            const res = await get('/applications/export', { season: '2026' });

            expect(res.statusCode).toEqual(403);
            expect(res.body.success).toEqual(false);
            expect(res.body.message).toEqual('You are not allowed to export the application statistics.');
        });

        test('should return 400 if the season is not given', async () => {
            const res = await get('/applications/export');

            expect(res.statusCode).toEqual(400);
            expect(res.body.message).toEqual('Season should be a year.');
        });

        test('should return 400 if the season is empty', async () => {
            const res = await get('/applications/export', { season: '' });

            expect(res.statusCode).toEqual(400);
            expect(res.body.message).toEqual('Season should be a year.');
        });

        test('should return 400 if the season is not a year', async () => {
            const res = await get('/applications/export', { season: 'abc' });

            expect(res.statusCode).toEqual(400);
            expect(res.body.message).toEqual('Season should be a year.');
        });

        test('should export the unique applicants by body for the season', async () => {
            const first = await generator.createEvent({ name: 'First SU', season: 2026 });
            const second = await generator.createEvent({ name: 'Second SU', season: 2026 });
            const old = await generator.createEvent({ name: 'Old SU', season: 2025 });
            // Created out of the expected order, so the test fails if the export isn't sorted.
            // Rejected and cancelled applicants count too, like in the statistics.
            await generator.createApplication(second, { user_id: 13, body_name: 'AEGEE-Zaragoza', status: 'rejected' });
            await generator.createApplication(first, { user_id: 12, body_name: 'AEGEE-Alicante', cancelled: true });
            await generator.createApplication(first, { user_id: 10, body_name: 'AEGEE-Dresden' });
            await generator.createApplication(second, { user_id: 10, body_name: 'AEGEE-Dresden' });
            await generator.createApplication(first, { user_id: 11, body_name: 'AEGEE-Dresden' });
            await generator.createApplication(old, { user_id: 14, body_name: 'AEGEE-Kyiv' });

            const res = await getExport({ season: '2026' });

            expect(res.statusCode).toEqual(200);
            expect(res.headers['content-type']).toEqual('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            expect(res.headers['content-disposition']).toEqual('attachment; filename=su_stats_by_body_2026.xlsx');

            const [sheet] = xlsx.parse(res.body);
            expect(sheet.name).toEqual('By body');
            expect(sheet.data).toEqual([
                ['Body', 'Applicants'],
                ['AEGEE-Dresden', 2],
                ['AEGEE-Alicante', 1],
                ['AEGEE-Zaragoza', 1]
            ]);
        });

        test('should export only the header for a season without applications', async () => {
            const res = await getExport({ season: '2024' });

            expect(res.statusCode).toEqual(200);

            const [sheet] = xlsx.parse(res.body);
            expect(sheet.data).toEqual([['Body', 'Applicants']]);
        });

        test('should be allowed for a user who can approve Summer Universities', async () => {
            mock.mockAll({
                core: { notSuperadmin: true },
                mainPermissions: { permissions: ['global:approve_summeruniversity:pilot'] },
                approvePermissions: { noPermissions: true }
            });

            const res = await getExport({ season: '2026' });

            expect(res.statusCode).toEqual(200);
        });

        test('should be allowed for a user who can manage pilot Summer Universities', async () => {
            mock.mockAll({
                core: { notSuperadmin: true },
                mainPermissions: { permissions: ['global:manage_summeruniversity:pilot'] },
                approvePermissions: { noPermissions: true }
            });

            const res = await getExport({ season: '2026' });

            expect(res.statusCode).toEqual(200);
        });
    });
});
