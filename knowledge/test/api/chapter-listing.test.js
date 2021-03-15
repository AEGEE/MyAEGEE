const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock');
const generator = require('../scripts/generator');

describe('Chapter listing', () => {
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
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
    });

    test('should succeed if everything is okay', async () => {
        const course = await generator.createCourse();
        const chapter = await generator.createChapter({ course_id: course.id });

        const res = await request({
            uri: '/courses/' + course.id + '/chapters',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(chapter.id);
    });

    test('should respect limit and offset', async () => {
        const course = await generator.createCourse();

        await generator.createChapter({ course_id: course.id });
        const chapter = await generator.createChapter({ course_id: course.id });
        await generator.createChapter({ course_id: course.id });

        const res = await request({
            uri: '/courses/' + course.id + '/chapters?limit=1&offset=1', // second one should be returned
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(chapter.id);

        expect(res.body.meta.count).toEqual(3);
    });

    test('should respect sorting', async () => {
        const course = await generator.createCourse();

        const firstChapter = await generator.createChapter({ name: 'aaa', course_id: course.id });
        const secondChapter = await generator.createChapter({ name: 'bbb', course_id: course.id });

        const res = await request({
            uri: '/courses/' + course.id + '/chapters?sort=name&direction=desc', // second one should be returned
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(2);
        expect(res.body.data[0].id).toEqual(secondChapter.id);
        expect(res.body.data[1].id).toEqual(firstChapter.id);
    });
});
