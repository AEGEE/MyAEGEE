const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock');
const generator = require('../scripts/generator');
const { Page } = require('../../models');

describe('Page creating', () => {
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

        const res = await request({
            uri: '/courses/' + course.id + '/chapters/' + chapter.id + '/pages',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generatePage()
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
    });

    test('should succeed if everything is okay', async () => {
        const course = await generator.createCourse();
        const chapter = await generator.createChapter({ course_id: course.id });

        const res = await request({
            uri: '/courses/' + course.id + '/chapters/' + chapter.id + '/pages',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generatePage({ name: 'test' })
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data.name).toEqual('test');
        expect(res.body.data.chapter_id).toEqual(chapter.id);

        const pageFromDB = await Page.findOne({ where: { id: res.body.data.id } });

        expect(pageFromDB.name).toEqual('test');
        expect(pageFromDB.chapter_id).toEqual(chapter.id);
    });

    test('should fail if name is not set', async () => {
        const course = await generator.createCourse();
        const chapter = await generator.createChapter({ course_id: course.id });

        const res = await request({
            uri: '/courses/' + course.id + '/chapters/' + chapter.id + '/pages',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generatePage({ name: null })
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('name');
    });
});
