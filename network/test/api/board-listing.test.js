const moment = require('moment');
const faker = require('faker');

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
            uri: '/boards',
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
            uri: '/boards',
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
            uri: '/bodies/1',
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
            uri: 'bodies/NaN',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if no boards exist', async () => {
        await generator.createBoard({ body_id: 2 });

        const res = await request({
            uri: 'bodies/1',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should list current board on', async () => {
        await generator.createBoard({ body_id: 1, start_date: faker.date.past(), end_date: faker.date.future() });

        const res = await request({
            uri: '/bodies/1/boards/current',
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
            uri: 'bodies/NaN/boards/current',
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
            uri: 'bodies/1/boards/current',
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
            uri: '/boards?sort=start_date&direction=desc',
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
            uri: '/bodies/1?sort=start_date&direction=desc',
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
});
