const moment = require('moment');
const { faker } = require('@faker-js/faker');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock');
const generator = require('../scripts/generator');

describe('Board listing', () => {
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
        await generator.clearAll();
        mock.cleanAll();
    });

    test('should fail if no permission', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const res = await request({
            path: '/boards',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
    });

    test('should fail for the current board of body if no permission', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const res = await request({
            path: '/bodies/1/boards/current',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
    });

    test('should fail for most recent elected board of all bodies if no permission', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const res = await request({
            path: '/boards/recents',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
    });

    test('should fail for all boards of body if no permission', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const res = await request({
            path: '/bodies/1/boards',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
    });

    test('should fail for the current board of body if no permission', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const res = await request({
            path: '/bodies/1/boards/current',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
    });

    test('should list all boards on / GET', async () => {
        await generator.createBoard();
        await generator.createBoard();

        const res = await request({
            path: '/boards',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(2);
    });

    test('should list all boards on /:body_id GET', async () => {
        await generator.createBoard({ body_id: 1 });
        await generator.createBoard({ body_id: 1 });
        await generator.createBoard({ body_id: 2 });

        const res = await request({
            path: '/bodies/1/boards',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(2);
    });

    test('should fail if body_id is not a number', async () => {
        const res = await request({
            path: 'bodies/NaN/boards',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return an empty list for a body without boards', async () => {
        await generator.createBoard({ body_id: 2 });

        const res = await request({
            path: '/bodies/1/boards',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data).toEqual([]);
    });

    test('should list current board on', async () => {
        await generator.createBoard({ body_id: 1, start_date: faker.date.past(), end_date: faker.date.future() });

        const res = await request({
            path: '/bodies/1/boards/current',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(1);
    });

    test('should list current board if no end date is set', async () => {
        await generator.createBoard({ body_id: 1, start_date: faker.date.past() });

        const res = await request({
            path: 'bodies/1/boards/current',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(1);
    });

    test('should fail if body_id current board is not a number', async () => {
        const res = await request({
            path: 'bodies/NaN/boards/current',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if current board does not exist', async () => {
        await generator.createBoard({ body_id: 1, start_date: faker.date.future() });

        const res = await request({
            path: 'bodies/1/boards/current',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should sort boards properly on / GET', async () => {
        const first = await generator.createBoard({
            start_date: moment().add(2, 'years').toDate()
        });
        const third = await generator.createBoard({
            start_date: moment().toDate()
        });
        const second = await generator.createBoard({
            start_date: moment().add(1, 'year').toDate()
        });

        const res = await request({
            path: '/boards?sort=start_date&direction=desc',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(3);

        expect(res.body.data[0].id).toEqual(first.id);
        expect(res.body.data[1].id).toEqual(second.id);
        expect(res.body.data[2].id).toEqual(third.id);
    });

    test('should ignore an unknown sort field and use the default order', async () => {
        const first = await generator.createBoard();
        const second = await generator.createBoard();

        const res = await request({
            path: '/boards?sort=lalala&direction=desc',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.length).toEqual(2);
        expect(res.body.data[0].id).toEqual(second.id);
        expect(res.body.data[1].id).toEqual(first.id);
    });

    test('should sort boards properly on /:body_id GET', async () => {
        const first = await generator.createBoard({
            body_id: 1,
            start_date: moment().add(2, 'years').toDate()
        });
        const third = await generator.createBoard({
            body_id: 1,
            start_date: moment().toDate()
        });
        const second = await generator.createBoard({
            body_id: 1,
            start_date: moment().add(1, 'year').toDate()
        });
        await generator.createBoard({ body_id: 2 });

        const res = await request({
            path: '/bodies/1/boards?sort=start_date&direction=desc',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(3);

        expect(res.body.data[0].id).toEqual(first.id);
        expect(res.body.data[1].id).toEqual(second.id);
        expect(res.body.data[2].id).toEqual(third.id);
    });

    test('should list only most recently elected board', async () => {
        await generator.createBoard({
            body_id: 1,
            elected_date: moment().subtract(2, 'weeks').toDate()
        });
        const mostRecentBoard = await generator.createBoard({
            body_id: 1,
            elected_date: moment().subtract(1, 'weeks').toDate()
        });

        const res = await request({
            path: '/boards/recents',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].latest_election).toEqual(mostRecentBoard.elected_date);
    });

    test('should not list boards elected in the future', async () => {
        const formerBoard = await generator.createBoard({
            body_id: 1,
            elected_date: moment().subtract(2, 'weeks').toDate()
        });
        await generator.createBoard({
            body_id: 1,
            elected_date: moment().toDate()
        });

        const ends = moment().subtract(1, 'weeks').toISOString();

        const res = await request({
            path: '/boards/recents?ends=' + ends,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].latest_election).toEqual(formerBoard.elected_date);
    });

    test.each([
        '/boards',
        '/boards/recents',
        '/bodies/34/boards',
        '/bodies/34/boards/current'
    ])('should show %s to members holding only the global view permission', async (path) => {
        mock.mockAll({ mainPermissions: { viewOnly: true }, managePermissions: { noPermissions: true } });
        await generator.createBoard({ body_id: 34, elected_date: moment().subtract(1, 'week').toDate(), start_date: moment().subtract(1, 'day').toDate() });

        const res = await request({
            path,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.length).toEqual(1);
    });

    test.each([
        'not-a-date',
        '2026-13-45',
        ['2021-01-10', '2021-01-11'],
        'x2026',
        '1',
        '2021',
        '20210110',
        '2021-01-10garbage',
        '2021-01-10 16:00',
        '2021-01-10T25:00:00.000Z',
        '2021-01-10T16:00:00.000Zgarbage'
    ])('should fail with 422 if ends is %p', async (ends) => {
        const res = await request({
            path: '/boards/recents',
            method: 'GET',
            query: { ends },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body.errors).toEqual({ ends: ['The end date should be a date (YYYY-MM-DD) or an ISO 8601 timestamp.'] });
    });

    test('should list the boards elected up to the day in ends', async () => {
        await generator.createBoard({ body_id: 1, elected_date: '2020-01-10' });
        await generator.createBoard({ body_id: 1, elected_date: '2021-01-10' });
        await generator.createBoard({ body_id: 2, elected_date: '2022-01-10' });

        const res = await request({
            path: '/boards/recents',
            method: 'GET',
            query: { ends: '2021-01-10' },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data).toEqual([{ body_id: 1, latest_election: '2021-01-10' }]);
    });

    test('should read the day of a timestamp in ends, as the Antenna Criteria page sends an Agora end', async () => {
        await generator.createBoard({ body_id: 1, elected_date: '2021-01-10' });
        await generator.createBoard({ body_id: 2, elected_date: '2021-01-11' });

        const res = await request({
            path: '/boards/recents',
            method: 'GET',
            query: { ends: '2021-01-10T16:00:00.000Z' },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data).toEqual([{ body_id: 1, latest_election: '2021-01-10' }]);
    });

    test.each([
        '2021-01-10T23:59:59Z',
        '2021-01-10T16:00:00+02:00',
        '2021-01-10T16:00Z'
    ])('should accept the timestamp %p in ends and count it by its day', async (ends) => {
        await generator.createBoard({ body_id: 1, elected_date: '2021-01-10' });
        await generator.createBoard({ body_id: 2, elected_date: '2021-01-11' });

        const res = await request({
            path: '/boards/recents',
            method: 'GET',
            query: { ends },
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data).toEqual([{ body_id: 1, latest_election: '2021-01-10' }]);
    });
});
