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
            uri: '/categories',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateCategory()
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
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
            uri: '/categories',
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
            uri: '/categories',
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
            uri: '/categories',
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
            uri: '/categories',
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
            uri: '/categories',
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
            uri: '/categories',
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
            uri: '/categories',
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
            uri: '/categories',
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
            uri: '/categories',
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
});
