const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const { ResourceCategory, ResourceLink } = require('../../models');

// Superadmins get every permission that exists in the DB.
const createManager = async () => {
    const user = await generator.createUser({ superadmin: true });
    await generator.createPermission({ scope: 'global', action: 'manage', object: 'resources' });
    return generator.createAccessToken(user);
};

const createMember = async () => {
    const user = await generator.createUser();
    return generator.createAccessToken(user);
};

const call = (token, method, path, body) => request({
    path,
    method,
    headers: token ? { 'X-Auth-Token': token.value } : {},
    body
});

describe('Resources', () => {
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

    describe('listing', () => {
        test('should fail when not logged in', async () => {
            const res = await call(null, 'GET', '/resources');

            expect(res.statusCode).toEqual(401);
            expect(res.body.success).toEqual(false);
        });

        test('should list sections and their links in order for any member', async () => {
            const token = await createMember();

            const second = await generator.createResourceCategory({ name: 'Second', position: 1 });
            const first = await generator.createResourceCategory({ name: 'First', position: 0 });
            const lastLink = await generator.createResourceLink(first, { position: 2 });
            const firstLink = await generator.createResourceLink(first, { position: 0 });

            const res = await call(token, 'GET', '/resources');

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body.data.map((category) => category.id)).toEqual([first.id, second.id]);
            expect(res.body.data[0].links.map((link) => link.id)).toEqual([firstLink.id, lastLink.id]);
            expect(res.body.data[1].links).toEqual([]);
            expect(res.body.data[0]).toHaveProperty('theme', 'blue');
        });

        test('should return one section with its links', async () => {
            const token = await createMember();
            const category = await generator.createResourceCategory();
            const link = await generator.createResourceLink(category);

            const res = await call(token, 'GET', '/resources/categories/' + category.id);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.id).toEqual(category.id);
            expect(res.body.data.links.map((item) => item.id)).toEqual([link.id]);
        });

        test('should return one link', async () => {
            const token = await createMember();
            const category = await generator.createResourceCategory();
            const link = await generator.createResourceLink(category);

            const res = await call(token, 'GET', '/resources/links/' + link.id);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({ id: link.id, category_id: category.id, url: link.url });
        });

        test('should return 404 for a section that does not exist', async () => {
            const token = await createMember();

            const res = await call(token, 'GET', '/resources/categories/1337');

            expect(res.statusCode).toEqual(404);
            expect(res.body.success).toEqual(false);
        });

        test('should return 400 for an invalid section ID', async () => {
            const token = await createMember();

            const res = await call(token, 'GET', '/resources/categories/abc');

            expect(res.statusCode).toEqual(400);
        });

        test('should return 404 for a link that does not exist', async () => {
            const token = await createMember();

            const res = await call(token, 'GET', '/resources/links/1337');

            expect(res.statusCode).toEqual(404);
        });

        test('should return 400 for an invalid link ID', async () => {
            const token = await createMember();

            const res = await call(token, 'GET', '/resources/links/abc');

            expect(res.statusCode).toEqual(400);
        });
    });

    describe('without global:manage:resources', () => {
        let token;
        let category;
        let link;

        beforeEach(async () => {
            token = await createMember();
            category = await generator.createResourceCategory();
            link = await generator.createResourceLink(category);
        });

        test.each([
            ['POST', () => '/resources/categories', () => ({ name: 'New', theme: 'red' })],
            ['PUT', () => '/resources/categories/order', () => ({ ids: [category.id] })],
            ['PUT', () => '/resources/categories/' + category.id, () => ({ name: 'Renamed' })],
            ['DELETE', () => '/resources/categories/' + category.id, () => undefined],
            ['PUT', () => '/resources/categories/' + category.id + '/links/order', () => ({ ids: [link.id] })],
            ['POST', () => '/resources/links', () => ({ category_id: category.id, title: 'T', description: 'D', url: '/x' })],
            ['PUT', () => '/resources/links/' + link.id, () => ({ title: 'Renamed' })],
            ['DELETE', () => '/resources/links/' + link.id, () => undefined]
        ])('%s should be forbidden', async (method, path, body) => {
            const res = await call(token, method, path(), body());

            expect(res.statusCode).toEqual(403);
            expect(res.body.success).toEqual(false);
            expect(res.body).toHaveProperty('message');
        });

        test('should not change anything', async () => {
            await call(token, 'PUT', '/resources/categories/' + category.id, { name: 'Renamed' });
            await call(token, 'DELETE', '/resources/links/' + link.id);

            expect((await ResourceCategory.findByPk(category.id)).name).toEqual(category.name);
            expect(await ResourceLink.findByPk(link.id)).not.toEqual(null);
        });
    });

    describe('sections', () => {
        test('should create a section at the end', async () => {
            const token = await createManager();
            await generator.createResourceCategory({ position: 4 });

            const res = await call(token, 'POST', '/resources/categories', { name: ' Financial ', theme: 'blue-dark', position: 0, id: 1337 });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({ name: 'Financial', theme: 'blue-dark', position: 5 });
            expect(res.body.data.id).not.toEqual(1337);
        });

        test('should create the first section at position 0', async () => {
            const token = await createManager();

            const res = await call(token, 'POST', '/resources/categories', { name: 'First', theme: 'red' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.position).toEqual(0);
        });

        test('should return validation errors when creating', async () => {
            const token = await createManager();

            const res = await call(token, 'POST', '/resources/categories', { name: '', theme: 'pink' });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('name');
            expect(res.body.errors).toHaveProperty('theme');
        });

        test('should update the name and theme but not the position', async () => {
            const token = await createManager();
            const category = await generator.createResourceCategory({ position: 3 });

            const res = await call(token, 'PUT', '/resources/categories/' + category.id, { name: 'Renamed', theme: 'green', position: 0 });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({ name: 'Renamed', theme: 'green', position: 3 });
        });

        test('should keep fields that are not sent', async () => {
            const token = await createManager();
            const category = await generator.createResourceCategory({ theme: 'purple' });

            const res = await call(token, 'PUT', '/resources/categories/' + category.id, { name: 'Renamed' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({ name: 'Renamed', theme: 'purple' });
        });

        test('should return validation errors when updating', async () => {
            const token = await createManager();
            const category = await generator.createResourceCategory();

            const res = await call(token, 'PUT', '/resources/categories/' + category.id, { theme: 'pink' });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('theme');
        });

        test('should delete an empty section', async () => {
            const token = await createManager();
            const category = await generator.createResourceCategory();

            const res = await call(token, 'DELETE', '/resources/categories/' + category.id);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(await ResourceCategory.findByPk(category.id)).toEqual(null);
        });

        test('should refuse to delete a section with links', async () => {
            const token = await createManager();
            const category = await generator.createResourceCategory();
            await generator.createResourceLink(category);
            await generator.createResourceLink(category);

            const res = await call(token, 'DELETE', '/resources/categories/' + category.id);

            expect(res.statusCode).toEqual(409);
            expect(res.body.success).toEqual(false);
            expect(res.body.message).toContain('2 link(s)');
            expect(await ResourceCategory.findByPk(category.id)).not.toEqual(null);
        });
    });

    describe('section order', () => {
        test('should reorder the sections', async () => {
            const token = await createManager();
            const first = await generator.createResourceCategory({ position: 0 });
            const second = await generator.createResourceCategory({ position: 1 });
            const third = await generator.createResourceCategory({ position: 2 });

            const res = await call(token, 'PUT', '/resources/categories/order', { ids: [third.id, first.id, second.id] });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.map((category) => category.id)).toEqual([third.id, first.id, second.id]);
            expect((await ResourceCategory.findByPk(third.id)).position).toEqual(0);
            expect((await ResourceCategory.findByPk(second.id)).position).toEqual(2);
        });

        test.each([
            ['not an array', () => 'nope'],
            ['missing a section', (ids) => ids.slice(1)],
            ['listing a section twice', (ids) => [ids[0], ...ids]],
            ['replacing a section with another ID', (ids) => [ids[0], 1337]],
            ['containing something other than IDs', (ids) => [ids[0], String(ids[1])]]
        ])('should refuse a list %s', async (_name, makeIds) => {
            const token = await createManager();
            const first = await generator.createResourceCategory({ position: 0 });
            const second = await generator.createResourceCategory({ position: 1 });

            const res = await call(token, 'PUT', '/resources/categories/order', { ids: makeIds([second.id, first.id]) });

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect((await ResourceCategory.findByPk(first.id)).position).toEqual(0);
        });

        test('should refuse a missing body', async () => {
            const token = await createManager();
            await generator.createResourceCategory();

            const res = await call(token, 'PUT', '/resources/categories/order');

            expect(res.statusCode).toEqual(422);
        });
    });

    describe('links', () => {
        test('should create a link at the end of its section', async () => {
            const token = await createManager();
            const category = await generator.createResourceCategory();
            await generator.createResourceLink(category, { position: 2 });

            const res = await call(token, 'POST', '/resources/links', {
                category_id: String(category.id),
                title: 'Mailing Lists',
                description: 'AEGEE mailing lists',
                url: '/pages/mailing-lists',
                position: 0
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({ category_id: category.id, url: '/pages/mailing-lists', position: 3 });
        });

        test('should create the first link of a section at position 0', async () => {
            const token = await createManager();
            const category = await generator.createResourceCategory();
            await generator.createResourceLink(await generator.createResourceCategory(), { position: 5 });

            const res = await call(token, 'POST', '/resources/links', {
                category_id: category.id,
                title: 'Title',
                description: 'Description',
                url: 'https://aegee.org'
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.position).toEqual(0);
        });

        test.each([
            ['missing', undefined],
            ['not existing', 1337],
            ['not a number', 'abc'],
            ['not an integer', 1.5]
        ])('should refuse a section that is %s', async (_name, categoryId) => {
            const token = await createManager();

            const res = await call(token, 'POST', '/resources/links', {
                category_id: categoryId,
                title: 'Title',
                description: 'Description',
                url: 'https://aegee.org'
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('category_id');
        });

        test('should refuse a javascript: URL', async () => {
            const token = await createManager();
            const category = await generator.createResourceCategory();

            const res = await call(token, 'POST', '/resources/links', {
                category_id: category.id,
                title: 'Title',
                description: 'Description',
                url: 'javascript:alert(document.cookie)' // eslint-disable-line no-script-url
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('url');
        });

        test('should update a link but not its position', async () => {
            const token = await createManager();
            const category = await generator.createResourceCategory();
            const link = await generator.createResourceLink(category, { position: 1 });

            const res = await call(token, 'PUT', '/resources/links/' + link.id, {
                category_id: category.id,
                title: 'New title',
                description: 'New description',
                url: 'https://aegee.org/new',
                position: 7
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({
                category_id: category.id,
                title: 'New title',
                description: 'New description',
                url: 'https://aegee.org/new',
                position: 1
            });
        });

        test('should move a link to the end of another section', async () => {
            const token = await createManager();
            const from = await generator.createResourceCategory();
            const to = await generator.createResourceCategory();
            const link = await generator.createResourceLink(from, { position: 0 });
            await generator.createResourceLink(to, { position: 0 });
            await generator.createResourceLink(to, { position: 1 });

            const res = await call(token, 'PUT', '/resources/links/' + link.id, { category_id: to.id });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({ category_id: to.id, position: 2 });
        });

        test('should refuse to move a link to a section that does not exist', async () => {
            const token = await createManager();
            const category = await generator.createResourceCategory();
            const link = await generator.createResourceLink(category);

            const res = await call(token, 'PUT', '/resources/links/' + link.id, { category_id: 1337 });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('category_id');
            expect((await ResourceLink.findByPk(link.id)).category_id).toEqual(category.id);
        });

        test('should return validation errors when updating', async () => {
            const token = await createManager();
            const category = await generator.createResourceCategory();
            const link = await generator.createResourceLink(category);

            const res = await call(token, 'PUT', '/resources/links/' + link.id, { url: '//evil.example.com' });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toHaveProperty('url');
        });

        test('should delete a link', async () => {
            const token = await createManager();
            const category = await generator.createResourceCategory();
            const link = await generator.createResourceLink(category);

            const res = await call(token, 'DELETE', '/resources/links/' + link.id);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(await ResourceLink.findByPk(link.id)).toEqual(null);
        });
    });

    describe('link order', () => {
        test('should reorder the links of a section', async () => {
            const token = await createManager();
            const category = await generator.createResourceCategory();
            const first = await generator.createResourceLink(category, { position: 0 });
            const second = await generator.createResourceLink(category, { position: 1 });

            const res = await call(token, 'PUT', '/resources/categories/' + category.id + '/links/order', { ids: [second.id, first.id] });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.links.map((link) => link.id)).toEqual([second.id, first.id]);
            expect((await ResourceLink.findByPk(first.id)).position).toEqual(1);
        });

        test('should refuse links of another section', async () => {
            const token = await createManager();
            const category = await generator.createResourceCategory();
            const other = await generator.createResourceCategory();
            const link = await generator.createResourceLink(category);
            const otherLink = await generator.createResourceLink(other);

            const res = await call(token, 'PUT', '/resources/categories/' + category.id + '/links/order', { ids: [otherLink.id, link.id] });

            expect(res.statusCode).toEqual(422);
            expect((await ResourceLink.findByPk(otherLink.id)).position).toEqual(0);
        });
    });
});
