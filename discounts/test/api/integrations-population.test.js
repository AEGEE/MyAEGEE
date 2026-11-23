const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock');
const generator = require('../scripts/generator');

const { Code } = require('../../models');

describe('Integrations codes population', () => {
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

        const integration = await generator.createIntegration({ code: 'first' });

        const res = await request({
            path: '/integrations/' + integration.id + '/codes',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: ['first', 'second', 'third']
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
    });

    test('should succeed if everything is okay', async () => {
        const integration = await generator.createIntegration({ code: 'first' });
        const res = await request({
            path: '/integrations/' + integration.id + '/codes',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: ['first', 'second', 'third']
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('message');

        const codesFromDb = await Code.count({ where: { integration_id: integration.id } });
        expect(codesFromDb).toEqual(3);
    });

    test('should fail if body is not an array', async () => {
        const integration = await generator.createIntegration({ code: 'first' });
        const res = await request({
            path: '/integrations/' + integration.id + '/codes',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {}
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if body is empty array', async () => {
        const integration = await generator.createIntegration({ code: 'first' });
        const res = await request({
            path: '/integrations/' + integration.id + '/codes',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: []
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if integration is not found', async () => {
        const res = await request({
            path: '/integrations/1337/codes',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: ['first']
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });
    test.each([
        ['an empty string', ['first', '']],
        ['only spaces', ['first', '   ']],
        ['a number', ['first', 123]],
        ['an object', ['first', {}]],
        ['null', ['first', null]],
        ['an array', ['first', ['second']]]
    ])('should fail with 422 and store no codes if a code is %s', async (_, body) => {
        const integration = await generator.createIntegration({ code: 'first' });
        const res = await request({
            path: '/integrations/' + integration.id + '/codes',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body.message).toEqual('Every code should be a non-empty string.');

        const codesFromDb = await Code.count({ where: { integration_id: integration.id } });
        expect(codesFromDb).toEqual(0);
    });

    // Codes are stored in a varchar(255) column.
    test('should fail with 422 and store no codes if a code is longer than 255 characters', async () => {
        const integration = await generator.createIntegration({ code: 'first' });
        const res = await request({
            path: '/integrations/' + integration.id + '/codes',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: ['first', 'a'.repeat(256)]
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body.message).toEqual('Every code should be at most 255 characters long.');

        const codesFromDb = await Code.count({ where: { integration_id: integration.id } });
        expect(codesFromDb).toEqual(0);
    });

    test('should store a code of 255 characters', async () => {
        const integration = await generator.createIntegration({ code: 'first' });
        const res = await request({
            path: '/integrations/' + integration.id + '/codes',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: ['a'.repeat(255)]
        });

        expect(res.statusCode).toEqual(200);

        const codesFromDb = await Code.findAll({ where: { integration_id: integration.id } });
        expect(codesFromDb.map((code) => code.value)).toEqual(['a'.repeat(255)]);
    });

    test('should store codes without their surrounding spaces', async () => {
        const integration = await generator.createIntegration({ code: 'first' });
        const res = await request({
            path: '/integrations/' + integration.id + '/codes',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: ['  first  ', '\tsecond\r', 'third code']
        });

        expect(res.statusCode).toEqual(200);

        const codesFromDb = await Code.findAll({ where: { integration_id: integration.id }, order: [['id', 'ASC']] });
        expect(codesFromDb.map((code) => code.value)).toEqual(['first', 'second', 'third code']);
    });

    test('should check the length of a code without its surrounding spaces', async () => {
        const integration = await generator.createIntegration({ code: 'first' });
        const res = await request({
            path: '/integrations/' + integration.id + '/codes',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: [' ' + 'a'.repeat(255) + ' ']
        });

        expect(res.statusCode).toEqual(200);

        const codesFromDb = await Code.findAll({ where: { integration_id: integration.id } });
        expect(codesFromDb.map((code) => code.value)).toEqual(['a'.repeat(255)]);
    });

    // Two members must never be handed the same code, so a code is stored once per integration.
    test('should store a code only once if the request has it twice', async () => {
        const integration = await generator.createIntegration({ code: 'first' });
        const res = await request({
            path: '/integrations/' + integration.id + '/codes',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: ['first', 'second', 'first']
        });

        expect(res.statusCode).toEqual(200);

        const codesFromDb = await Code.findAll({ where: { integration_id: integration.id }, order: [['id', 'ASC']] });
        expect(codesFromDb.map((code) => code.value)).toEqual(['first', 'second']);
    });

    test('should store a code only once if a pasted list has it with different spaces around it', async () => {
        const integration = await generator.createIntegration({ code: 'first' });
        const res = await request({
            path: '/integrations/' + integration.id + '/codes',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: ['ABC', 'ABC\r', ' ABC ', 'DEF\r']
        });

        expect(res.statusCode).toEqual(200);

        const codesFromDb = await Code.findAll({ where: { integration_id: integration.id }, order: [['id', 'ASC']] });
        expect(codesFromDb.map((code) => code.value)).toEqual(['ABC', 'DEF']);
    });

    test('should fail with 422, name the codes and store none if some codes are stored already', async () => {
        const integration = await generator.createIntegration({ code: 'first' });
        await generator.createCode({ value: 'first' }, integration);
        await generator.createCode({ value: 'third' }, integration);

        const res = await request({
            path: '/integrations/' + integration.id + '/codes',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: [' first\r', 'second', 'third', 'third']
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body.message).toEqual('These codes are stored for this integration already: first, third.');

        const codesFromDb = await Code.findAll({ where: { integration_id: integration.id }, order: [['id', 'ASC']] });
        expect(codesFromDb.map((code) => code.value)).toEqual(['first', 'third']);
    });

    test('should store a code that another integration has', async () => {
        const otherIntegration = await generator.createIntegration({ code: 'other' });
        await generator.createCode({ value: 'first' }, otherIntegration);
        const integration = await generator.createIntegration({ code: 'first' });

        const res = await request({
            path: '/integrations/' + integration.id + '/codes',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: ['first']
        });

        expect(res.statusCode).toEqual(200);
        expect(await Code.count({ where: { value: 'first' } })).toEqual(2);
    });

    test('should store a code once if two requests add it at the same time', async () => {
        const integration = await generator.createIntegration({ code: 'first' });
        const add = () => request({
            path: '/integrations/' + integration.id + '/codes',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: ['same']
        });

        const responses = await Promise.all([add(), add()]);

        expect(responses.map((res) => res.statusCode).sort()).toEqual([200, 422]);
        expect(await Code.count({ where: { integration_id: integration.id } })).toEqual(1);
    });
});
