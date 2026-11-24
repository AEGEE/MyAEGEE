const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock');
const generator = require('../scripts/generator');
const { Board } = require('../../models');
const body = require('../assets/core-local.json').data;

describe('Board deleting', () => {
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

        const board = await generator.createBoard();

        const res = await request({
            path: '/bodies/' + board.body_id + '/boards/' + board.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
    });

    test('should succeed if everything is okay', async () => {
        const board = await generator.createBoard({});

        const res = await request({
            path: '/bodies/' + board.body_id + '/boards/' + board.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        const boardFromDB = await Board.findByPk(board.id);

        expect(boardFromDB).toEqual(null);
    });

    test('should fail if board is not found', async () => {
        const res = await request({
            path: '/bodies/1/boards/1337',
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if body_id is not a number', async () => {
        const board = await generator.createBoard();

        const res = await request({
            path: '/bodies/lalala/boards/' + board.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body.message).toEqual('Body ID is invalid.');
    });

    test('should fail if the board belongs to another body', async () => {
        const board = await generator.createBoard({ body_id: 1 });

        const res = await request({
            path: '/bodies/2/boards/' + board.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);

        const boardFromDB = await Board.findByPk(board.id);
        expect(boardFromDB).not.toEqual(null);
    });

    test('should not let a board manager of the body delete its board', async () => {
        // A member with the view permission who manages body.id locally.
        mock.mockAll({ mainPermissions: { viewOnly: true } });

        const board = await generator.createBoard({ body_id: body.id });

        const res = await request({
            path: '/bodies/' + body.id + '/boards/' + board.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body.message).toContain('global:manage_network:boards');

        const boardFromDB = await Board.findByPk(board.id);
        expect(boardFromDB).not.toEqual(null);
    });

    test('should let a holder of the global board management permission delete a board of any body', async () => {
        // core-permissions-full.json holds global:manage_network:boards; no local permission.
        mock.mockAll({ managePermissions: { noPermissions: true } });

        const board = await generator.createBoard({ body_id: body.id });

        const res = await request({
            path: '/bodies/' + body.id + '/boards/' + board.id,
            method: 'DELETE',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);

        const boardFromDB = await Board.findByPk(board.id);
        expect(boardFromDB).toEqual(null);
    });
});
