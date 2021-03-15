const { startServer, stopServer } = require('../../lib/server.js');
const mock = require('../scripts/mock');
const generator = require('../scripts/generator');
const {
    Chapter,
    Page
} = require('../../models');

describe('Cascade deleting', () => {
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

    describe('Chapter deleting', () => {
        test('should delete all pages', async () => {
            const course = await generator.createCourse();
            const chapter = await generator.createChapter({ course_id: course.id });
            const page = await generator.createPage({ chapter_id: chapter.id });

            await chapter.destroy();

            const pageFromDB = await Page.findByPk(page.id);
            expect(pageFromDB).toEqual(null);
        });
    });

    describe('Course deleting', () => {
        test('should delete all chapters', async () => {
            const course = await generator.createCourse();
            const chapter = await generator.createChapter({ course_id: course.id });

            await course.destroy();

            const chapterFromDB = await Chapter.findByPk(chapter.id);
            expect(chapterFromDB).toEqual(null);
        });

        test('should delete all pages', async () => {
            const course = await generator.createCourse();
            const chapter = await generator.createChapter({ course_id: course.id });
            const page = await generator.createPage({ chapter_id: chapter.id });

            await course.destroy();

            const pageFromDB = await Page.findByPk(page.id);
            expect(pageFromDB).toEqual(null);
        });
    });
});
