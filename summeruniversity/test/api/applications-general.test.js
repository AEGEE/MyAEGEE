const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');

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

    const get = (path, query) => request({ path, method: 'GET', headers: { 'X-Auth-Token': 'foobar' }, query });

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
    });
});
