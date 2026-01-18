const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock');
const generator = require('../scripts/generator');
const { Course } = require('../../models');

describe('Course editing', () => {
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

        const course = await generator.createCourse();

        const res = await request({
            uri: '/courses/' + course.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { name: 'test' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
    });

    test('should succeed if everything is okay', async () => {
        const course = await generator.createCourse();

        const res = await request({
            uri: '/courses/' + course.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { name: 'test' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.name).toEqual('test');

        const courseFromDB = await Course.findOne({ where: { id: res.body.data.id } });

        expect(courseFromDB.name).toEqual('test');
    });

    test('should fail if name is not set', async () => {
        const course = await generator.createCourse();

        const res = await request({
            uri: '/courses/' + course.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { name: null }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('name');
    });

    test('should fail if course is not found', async () => {
        const res = await request({
            uri: '/courses/1337',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { name: 'test' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });
});
