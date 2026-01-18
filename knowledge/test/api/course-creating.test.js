const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock');
const generator = require('../scripts/generator');
const { Course } = require('../../models');

describe('Course creating', () => {
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
            uri: '/courses',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateCourse()
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
    });

    test('should succeed if everything is okay', async () => {
        const course = generator.generateCourse({
            name: 'test'
        });

        const res = await request({
            uri: '/courses',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: course
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
        const res = await request({
            uri: '/courses',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateCourse({ name: null })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('name');
    });
});
