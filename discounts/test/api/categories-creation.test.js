const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock');
const generator = require('../scripts/generator');
const { Category } = require('../../models');

describe('Categories creation', () => {
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
        const res = await request({
            path: '/categories',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateCategory()
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body.message).toEqual('You are not allowed to create categories.');
    });

    test('should succeed if everything is okay', async () => {
        const category = generator.generateCategory({
            name: 'test',
            discounts: [
                generator.generateDiscount({
                    name: 'testtest',
                    icon: 'fa-icon',
                    shortDescription: 'short',
                    longDescription: 'long'
                })
            ]
        });
        const res = await request({
            path: '/categories',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: category
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.name).toEqual('test');
        expect(res.body.data.discounts.length).toEqual(1);
        expect(res.body.data.discounts[0].name).toEqual('testtest');
        expect(res.body.data.discounts[0].icon).toEqual('fa-icon');
        expect(res.body.data.discounts[0].shortDescription).toEqual('short');
        expect(res.body.data.discounts[0].longDescription).toEqual('long');

        const categoryFromDB = await Category.findOne({ where: { id: res.body.data.id } });

        expect(categoryFromDB.name).toEqual('test');
        expect(categoryFromDB.discounts.length).toEqual(1);
        expect(categoryFromDB.discounts[0].name).toEqual('testtest');
        expect(categoryFromDB.discounts[0].icon).toEqual('fa-icon');
        expect(categoryFromDB.discounts[0].shortDescription).toEqual('short');
        expect(categoryFromDB.discounts[0].longDescription).toEqual('long');
    });

    test('should fail if name is not set', async () => {
        const res = await request({
            path: '/categories',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateCategory({ name: null })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('name');
    });

    test('should fail if discounts is not an array', async () => {
        const res = await request({
            path: '/categories',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateCategory({ discounts: false })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('discounts');
    });

    test('should fail if discounts is an empty array', async () => {
        const res = await request({
            path: '/categories',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateCategory({ discounts: [] })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('discounts');
    });

    test('should fail if discount is not an object', async () => {
        const res = await request({
            path: '/categories',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateCategory({ discounts: [false] })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('discounts');
    });

    test('should fail if discount\'s name is not set', async () => {
        const res = await request({
            path: '/categories',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateCategory({ discounts: [
                generator.generateDiscount({ name: null })
            ] })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('discounts');
    });

    test('should fail if discount\'s icon is not set', async () => {
        const res = await request({
            path: '/categories',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateCategory({ discounts: [
                generator.generateDiscount({ icon: null })
            ] })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('discounts');
    });

    test('should fail if discount\'s shortDescription is not set', async () => {
        const res = await request({
            path: '/categories',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateCategory({ discounts: [
                generator.generateDiscount({ shortDescription: null })
            ] })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('discounts');
    });

    test('should fail if discount\'s longDescription is not set', async () => {
        const res = await request({
            path: '/categories',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateCategory({ discounts: [
                generator.generateDiscount({ longDescription: null })
            ] })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('discounts');
    });

    test('should not let the body set the id or the timestamps', async () => {
        const res = await request({
            path: '/categories',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateCategory({
                id: 999,
                created_at: '2000-01-01T00:00:00.000Z',
                updated_at: '2000-01-01T00:00:00.000Z'
            })
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.id).not.toEqual(999);
        expect(res.body.data.created_at).not.toEqual('2000-01-01T00:00:00.000Z');
        expect(res.body.data.updated_at).not.toEqual('2000-01-01T00:00:00.000Z');

        expect(await Category.findByPk(999)).toBeNull();
    });

    test('should fail with 422 if the name is longer than 255 characters', async () => {
        const res = await request({
            path: '/categories',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateCategory({ name: 'a'.repeat(256) })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body.errors.name).toEqual(['Name should be at most 255 characters long.']);
        expect(await Category.count()).toEqual(0);
    });

    test('should accept a name of 255 characters', async () => {
        const res = await request({
            path: '/categories',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateCategory({ name: 'n'.repeat(255) })
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.name).toEqual('n'.repeat(255));
    });

    test('should fail if a discount has a key that is not one of the four fields', async () => {
        const res = await request({
            path: '/categories',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateCategory({
                discounts: [generator.generateDiscount({ url: 'https://example.org' })]
            })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body.errors).toHaveProperty('discounts');
    });

    test('should return the category as stored', async () => {
        const res = await request({
            path: '/categories',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateCategory()
        });

        expect(res.statusCode).toEqual(200);

        const categoryFromDb = await Category.findByPk(res.body.data.id);
        expect(res.body.data).toEqual(JSON.parse(JSON.stringify(categoryFromDb)));
    });
});
