const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Season } = require('../../models');

const managerMocks = { mainPermissions: { permissions: ['global:manage_seasons:summeruniversity'] } };
// Has every SU permission in the fixture, but not manage_seasons.
const nonManagerMocks = {};
const anonymousMocks = { core: { unauthorized: true }, mainPermissions: { unauthorized: true }, approvePermissions: { unauthorized: true } };

describe('Seasons', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        mock.cleanAll();
        await generator.clearAll();
    });

    const call = (method, path, body) => request({ path, method, headers: { 'X-Auth-Token': 'foobar' }, body });

    describe('listing', () => {
        test('should list the seasons, newest first, without logging in', async () => {
            mock.mockAll(anonymousMocks);
            await generator.createSeason({ year: 2025 });
            await generator.createSeason({ year: 2027 });

            const res = await call('GET', '/seasons');

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.map((season) => season.year)).toEqual([2027, 2026, 2025]);
        });

        test('should return the active season without logging in', async () => {
            mock.mockAll(anonymousMocks);

            const res = await call('GET', '/seasons/active');

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.year).toEqual(2026);
            expect(res.body.data.active).toEqual(true);
        });

        test('should return 404 if no season is active', async () => {
            mock.mockAll(anonymousMocks);
            await generator.activateSeason(null);

            const res = await call('GET', '/seasons/active');

            expect(res.statusCode).toEqual(404);
            expect(res.body.message).toEqual('There is no active season.');
        });
    });

    describe('creating', () => {
        const body = {
            year: 2027,
            name: 'Summer University 2027',
            event_submission_deadline: '2026-12-01T00:00:00.000Z',
            application_period_starts: '2027-02-01T00:00:00.000Z',
            application_period_ends: '2027-03-01T00:00:00.000Z'
        };

        test('should return 401 if the user is not authenticated', async () => {
            mock.mockAll(anonymousMocks);

            const res = await call('POST', '/seasons', body);

            expect(res.statusCode).toEqual(401);
            expect(await Season.count()).toEqual(1);
        });

        test('should return 403 without the manage_seasons permission', async () => {
            mock.mockAll(nonManagerMocks);

            const res = await call('POST', '/seasons', body);

            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toEqual('You are not allowed to manage seasons.');
            expect(await Season.count()).toEqual(1);
        });

        test('should create an inactive season', async () => {
            mock.mockAll(managerMocks);

            const res = await call('POST', '/seasons', { ...body, active: true, id: 1337 });

            expect(res.statusCode).toEqual(201);
            expect(res.body.data.year).toEqual(2027);
            expect(res.body.data.active).toEqual(false);
            expect(res.body.data.id).not.toEqual(1337);

            const season = await Season.findOne({ where: { year: 2027 } });
            expect(season.name).toEqual('Summer University 2027');
            expect(season.event_submission_deadline.toISOString()).toEqual(body.event_submission_deadline);
            expect(season.application_period_starts.toISOString()).toEqual(body.application_period_starts);
            expect(season.application_period_ends.toISOString()).toEqual(body.application_period_ends);
        });

        test('should return 422 if the year already exists', async () => {
            mock.mockAll(managerMocks);

            const res = await call('POST', '/seasons', { ...body, year: 2026 });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('year');
        });

        test('should return 422 if the name is empty', async () => {
            mock.mockAll(managerMocks);

            const res = await call('POST', '/seasons', { ...body, name: '' });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('name');
        });

        test('should return 422 if the application period ends before it starts', async () => {
            mock.mockAll(managerMocks);

            const res = await call('POST', '/seasons', { ...body, application_period_ends: '2027-01-01T00:00:00.000Z' });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('application_period_ends');
        });
    });

    describe('updating', () => {
        test('should return 403 without the manage_seasons permission', async () => {
            mock.mockAll(nonManagerMocks);

            const res = await call('PUT', '/seasons/2026', { name: 'Changed' });

            expect(res.statusCode).toEqual(403);
            expect((await Season.findOne({ where: { year: 2026 } })).name).not.toEqual('Changed');
        });

        test('should return 404 if the season does not exist', async () => {
            mock.mockAll(managerMocks);

            expect((await call('PUT', '/seasons/1999', { name: 'Changed' })).statusCode).toEqual(404);
            expect((await call('PUT', '/seasons/foo', { name: 'Changed' })).statusCode).toEqual(404);
        });

        test('should update the season, but not its year or active flag', async () => {
            mock.mockAll(managerMocks);
            await generator.createSeason({ year: 2027 });

            const res = await call('PUT', '/seasons/2027', {
                name: 'Changed',
                year: 2028,
                active: true,
                event_submission_deadline: '2026-12-01T00:00:00.000Z'
            });

            expect(res.statusCode).toEqual(200);
            const season = await Season.findOne({ where: { year: 2027 } });
            expect(season.name).toEqual('Changed');
            expect(season.active).toEqual(false);
            expect(season.event_submission_deadline.toISOString()).toEqual('2026-12-01T00:00:00.000Z');
            expect(await Season.count({ where: { year: 2028 } })).toEqual(0);
        });

        test('should return 422 on invalid data', async () => {
            mock.mockAll(managerMocks);

            const res = await call('PUT', '/seasons/2026', { name: '' });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('name');
        });
    });

    describe('setting the active season', () => {
        test('should return 403 without the manage_seasons permission', async () => {
            mock.mockAll(nonManagerMocks);
            await generator.createSeason({ year: 2027 });

            const res = await call('PUT', '/seasons/2027/active');

            expect(res.statusCode).toEqual(403);
            expect((await Season.findOne({ where: { active: true } })).year).toEqual(2026);
        });

        test('should return 404 if the season does not exist', async () => {
            mock.mockAll(managerMocks);

            const res = await call('PUT', '/seasons/1999/active');

            expect(res.statusCode).toEqual(404);
            expect((await Season.findOne({ where: { active: true } })).year).toEqual(2026);
        });

        test('should make the season the only active one', async () => {
            mock.mockAll(managerMocks);
            await generator.createSeason({ year: 2027 });

            const res = await call('PUT', '/seasons/2027/active');

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.active).toEqual(true);
            const active = await Season.findAll({ where: { active: true } });
            expect(active.map((season) => season.year)).toEqual([2027]);
        });

        test('should keep the season active if it already is', async () => {
            mock.mockAll(managerMocks);

            const res = await call('PUT', '/seasons/2026/active');

            expect(res.statusCode).toEqual(200);
            const active = await Season.findAll({ where: { active: true } });
            expect(active.map((season) => season.year)).toEqual([2026]);
        });

        test('should not allow a second active season in the database', async () => {
            await expect(generator.createSeason({ year: 2027, active: true }))
                .rejects.toHaveProperty('name', 'SequelizeUniqueConstraintError');
        });
    });
});
