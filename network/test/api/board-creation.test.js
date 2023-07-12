const { faker } = require('@faker-js/faker');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock');
const generator = require('../scripts/generator');
const body = require('../assets/core-local.json').data;
const user = require('../assets/core-valid.json').data;

describe('Board creation', () => {
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

    test('should fail if no permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const board = generator.generateBoard();

        const res = await request({
            uri: '/bodies/' + body.id + '/boards',
            method: 'POST',
            body: board,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
    });

    test('should fail if elected_date is not set', async () => {
        const board = generator.generateBoard({ elected_date: null });

        const res = await request({
            uri: '/bodies/' + body.id + '/boards',
            method: 'POST',
            body: board,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('elected_date');
    });

    test('should fail if elected_date is in the future', async () => {
        const board = generator.generateBoard({ elected_date: faker.date.future() });

        const res = await request({
            uri: '/bodies/' + body.id + '/boards',
            method: 'POST',
            body: board,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('elected_date');
    });

    test('should fail if start_date is not set', async () => {
        const board = generator.generateBoard({ start_date: null });

        const res = await request({
            uri: '/bodies/' + body.id + '/boards',
            method: 'POST',
            body: board,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('start_date');
    });

    test('should fail if end_date is in the past', async () => {
        const board = generator.generateBoard({ end_date: faker.date.past() });

        const res = await request({
            uri: '/bodies/' + body.id + '/boards',
            method: 'POST',
            body: board,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('end_date');
    });

    test('should fail if image_id is not a number', async () => {
        const board = generator.generateBoard({ image_id: 'NaN' });

        const res = await request({
            uri: '/bodies/' + body.id + '/boards',
            method: 'POST',
            body: board,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('image_id');
    });

    test('should fail if core user request returns net error', async () => {
        mock.mockAll({ member: { netError: true } });
        const board = generator.generateBoard({ president: user.id });

        const res = await request({
            uri: '/bodies/' + body.id + '/boards',
            method: 'POST',
            body: board,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if core user request returns garbage', async () => {
        mock.mockAll({ member: { badResponse: true } });
        const board = generator.generateBoard({ president: user.id });

        const res = await request({
            uri: '/bodies/' + body.id + '/boards',
            method: 'POST',
            body: board,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if core user request returns unsuccessful response', async () => {
        mock.mockAll({ member: { unsuccessfulResponse: true } });
        const board = generator.generateBoard({ president: user.id });

        const res = await request({
            uri: '/bodies/' + body.id + '/boards',
            method: 'POST',
            body: board,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if core body request returns net error', async () => {
        mock.mockAll({ body: { netError: true } });
        const board = generator.generateBoard({ body_id: body.id });

        const res = await request({
            uri: '/bodies/' + body.id + '/boards',
            method: 'POST',
            body: board,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if core body request returns garbage', async () => {
        mock.mockAll({ body: { badResponse: true } });
        const board = generator.generateBoard({ body_id: body.id });

        const res = await request({
            uri: '/bodies/' + body.id + '/boards',
            method: 'POST',
            body: board,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if core body request returns unsuccessful response', async () => {
        mock.mockAll({ body: { unsuccessfulResponse: true } });
        const board = generator.generateBoard({ body_id: body.id });

        const res = await request({
            uri: '/bodies/' + body.id + '/boards',
            method: 'POST',
            body: board,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed if everything is okay', async () => {
        const board = generator.generateBoard();

        const res = await request({
            uri: '/bodies/' + body.id + '/boards',
            method: 'POST',
            body: board,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data).toHaveProperty('elected_date');
        expect(res.body.data).toHaveProperty('start_date');
        expect(res.body.data).toHaveProperty('president');
        expect(res.body.data).toHaveProperty('secretary');
        expect(res.body.data).toHaveProperty('treasurer');
        expect(res.body.data).not.toHaveProperty('other_members');
    });

    test('should succeed for more positions if everything is okay', async () => {
        const board = generator.generateBoard({ other_members: [{ function: 'Test', user_id: user.id }] });

        const res = await request({
            uri: '/bodies/' + body.id + '/boards',
            method: 'POST',
            body: board,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data).toHaveProperty('other_members');
        expect(res.body.data.other_members[0].function).toEqual('Test');
        expect(res.body.data.other_members[0].user_id).toEqual(user.id);
    });
});
