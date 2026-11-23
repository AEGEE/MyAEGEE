const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock');
const generator = require('../scripts/generator');
const { Category } = require('../../models');

describe('Categories edition', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();

        await generator.clearAll();
    });

    test('should fail if user does not have rights', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const category = await generator.createCategory();

        const res = await request({
            path: '/categories/' + category.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { name: 'test' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
    });

    test('should succeed if everything is okay', async () => {
        const category = await generator.createCategory();
        const res = await request({
            path: '/categories/' + category.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { name: 'test' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.name).toEqual('test');
    });

    test('should fail on validation errors', async () => {
        const category = await generator.createCategory();
        const res = await request({
            path: '/categories/' + category.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { name: null }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('name');
    });

    test('should return 404 if the integration is not found', async () => {
        const res = await request({
            path: '/categories/1337',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { name: 'test' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should return 400 if the integration ID is NaN', async () => {
        const res = await request({
            path: '/categories/false',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { name: 'test' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should not let the body change the id or the timestamps', async () => {
        const category = await generator.createCategory();
        const res = await request({
            path: '/categories/' + category.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                id: 999,
                name: 'New name',
                created_at: '2000-01-01T00:00:00.000Z'
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.id).toEqual(category.id);
        expect(res.body.data.name).toEqual('New name');

        const categoryFromDb = await Category.findByPk(category.id);
        expect(categoryFromDb.name).toEqual('New name');
        expect(categoryFromDb.created_at.toISOString()).toEqual(category.created_at.toISOString());
        expect(await Category.findByPk(999)).toBeNull();
    });
});
