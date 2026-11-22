const { startServer, stopServer } = require('../../lib/server');
const generator = require('../scripts/generator');
const { ResourceCategory, ResourceLink } = require('../../models');

const expectValidationError = async (promise, path) => {
    await expect(promise).rejects.toMatchObject({
        name: 'SequelizeValidationError',
        errors: expect.arrayContaining([expect.objectContaining({ path })])
    });
};

describe('Resources testing', () => {
    beforeAll(async () => {
        await startServer();
        // The migration inserts the page's content; these tests start empty.
        await generator.clearAll();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    describe('sections', () => {
        test('should fail without a name', async () => {
            await expectValidationError(generator.createResourceCategory({ name: null }), 'name');
        });

        test('should fail with an empty name', async () => {
            await expectValidationError(generator.createResourceCategory({ name: '   ' }), 'name');
        });

        test('should fail with a name longer than 100 characters', async () => {
            await expectValidationError(generator.createResourceCategory({ name: 'a'.repeat(101) }), 'name');
        });

        test('should trim the name', async () => {
            const category = await generator.createResourceCategory({ name: '  Financial  ' });
            expect(category.name).toEqual('Financial');
        });

        test('should fail without a theme', async () => {
            await expectValidationError(generator.createResourceCategory({ theme: null }), 'theme');
        });

        test('should fail with a theme that is not a VI theme', async () => {
            await expectValidationError(generator.createResourceCategory({ theme: '#ff0000' }), 'theme');
        });

        test('should allow two sections with the same theme', async () => {
            await generator.createResourceCategory({ theme: 'red' });
            await generator.createResourceCategory({ theme: 'red' });

            expect(await ResourceCategory.count({ where: { theme: 'red' } })).toEqual(2);
        });

        test('should not be deleted while it has links', async () => {
            const category = await generator.createResourceCategory();
            await generator.createResourceLink(category);

            // 23001 is Postgres' restrict_violation.
            await expect(category.destroy()).rejects.toMatchObject({ original: { code: '23001' } });
            expect(await ResourceCategory.findByPk(category.id)).not.toEqual(null);
        });
    });

    describe('links', () => {
        let category;

        beforeEach(async () => {
            category = await generator.createResourceCategory();
        });

        test('should fail without a section', async () => {
            await expectValidationError(generator.createResourceLink(null, { category_id: null }), 'category_id');
        });

        test.each(['title', 'description', 'url'])('should fail without %s', async (field) => {
            await expectValidationError(generator.createResourceLink(category, { [field]: null }), field);
        });

        test.each(['title', 'description', 'url'])('should fail with an empty %s', async (field) => {
            await expectValidationError(generator.createResourceLink(category, { [field]: ' ' }), field);
        });

        test('should fail with a title longer than 100 characters', async () => {
            await expectValidationError(generator.createResourceLink(category, { title: 'a'.repeat(101) }), 'title');
        });

        test('should fail with a description longer than 255 characters', async () => {
            await expectValidationError(generator.createResourceLink(category, { description: 'a'.repeat(256) }), 'description');
        });

        test('should fail with a URL longer than 2048 characters', async () => {
            await expectValidationError(generator.createResourceLink(category, { url: 'https://aegee.org/' + 'a'.repeat(2048) }), 'url');
        });

        test('should trim the fields', async () => {
            const link = await generator.createResourceLink(category, {
                title: ' Title ',
                description: ' Description ',
                url: ' https://aegee.org '
            });

            expect(link.title).toEqual('Title');
            expect(link.description).toEqual('Description');
            expect(link.url).toEqual('https://aegee.org');
        });

        test.each([
            'https://aegee.org',
            'http://aegee.org/path?query=1#hash',
            '/pages/mailing-lists',
            '/'
        ])('should accept %s', async (url) => {
            const link = await generator.createResourceLink(category, { url });
            expect(link.url).toEqual(url);
        });

        test.each([
            'javascript:alert(1)', // eslint-disable-line no-script-url
            'JavaScript:alert(1)', // eslint-disable-line no-script-url
            'mailto:info@aegee.org',
            'ftp://aegee.org',
            'data:text/html,<script>alert(1)</script>',
            '//evil.example.com',
            '/\\evil.example.com',
            '/pages/with space',
            'https://aegee.org/with space',
            'https://',
            'aegee.org',
            'pages/mailing-lists'
        ])('should reject %s', async (url) => {
            await expectValidationError(generator.createResourceLink(category, { url }), 'url');
        });

        test('should be listed with its section', async () => {
            const link = await generator.createResourceLink(category);
            const found = await ResourceCategory.findByPk(category.id, { include: [{ model: ResourceLink, as: 'links' }] });

            expect(found.links.map((item) => item.id)).toEqual([link.id]);
        });
    });
});
