const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock');
const generator = require('../scripts/generator');

describe('Page details', () => {
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
        const chapter = await generator.createChapter({ course_id: course.id });
        const page = await generator.createPage({ chapter_id: chapter.id });

        const res = await request({
            uri: '/courses/' + course.id + '/chapters/' + chapter.id + '/pages/' + page.id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
    });

    test('should succeed if everything is okay', async () => {
        const course = await generator.createCourse();
        const chapter = await generator.createChapter({ course_id: course.id });
        const page = await generator.createPage({ chapter_id: chapter.id });

        const res = await request({
            uri: '/courses/' + course.id + '/chapters/' + chapter.id + '/pages/' + page.id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.id).toEqual(page.id);
    });

    test('should fail if page is not found', async () => {
        const course = await generator.createCourse();
        const chapter = await generator.createChapter({ course_id: course.id });

        const res = await request({
            uri: '/courses/' + course.id + '/chapters/' + chapter.id + '/pages/1337',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if page id is not a number', async () => {
        const course = await generator.createCourse();
        const chapter = await generator.createChapter({ course_id: course.id });

        const res = await request({
            uri: '/courses/' + course.id + '/chapters/' + chapter.id + '/pages/nan',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });
});
