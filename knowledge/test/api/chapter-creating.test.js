const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock');
const generator = require('../scripts/generator');
const { Chapter } = require('../../models');

describe('Chapter creating', () => {
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
            uri: '/courses/' + course.id + '/chapters',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateChapter()
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
    });

    test('should succeed if everything is okay', async () => {
        const course = await generator.createCourse();

        const res = await request({
            uri: '/courses/' + course.id + '/chapters',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateChapter({ name: 'test' })
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.name).toEqual('test');
        expect(res.body.data.course_id).toEqual(course.id);

        const chapterFromDB = await Chapter.findOne({ where: { id: res.body.data.id } });

        expect(chapterFromDB.name).toEqual('test');
        expect(chapterFromDB.course_id).toEqual(course.id);
    });

    test('should fail if name is not set', async () => {
        const course = await generator.createCourse();

        const res = await request({
            uri: '/courses/' + course.id + '/chapters',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateChapter({ name: null })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('name');
    });
});
