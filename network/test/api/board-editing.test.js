const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock');
const generator = require('../scripts/generator');
const body = require('../assets/core-local.json').data;
const { Board } = require('../../models');

describe('Board editing', () => {
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
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: board
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
    });

    test('should succeed if everything is okay', async () => {
        const board = await generator.createBoard({ message: 'some text' });

        await request({
            path: '/bodies/' + board.body_id + '/boards/' + board.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                message: 'a new text'
            }
        });

        const res = await request({
            path: '/bodies/' + board.body_id + '/boards/' + board.id,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.id).toEqual(board.id);
        expect(res.body.data.message).toEqual('a new text');
    });

    test('should fail if body_id is not a number', async () => {
        const board = await generator.createBoard();

        const res = await request({
            path: '/bodies/lalala/boards/' + board.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { message: 'a new text' }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body.message).toEqual('Body ID is invalid.');
    });

    test('should fail if the board belongs to another body', async () => {
        const board = await generator.createBoard({ body_id: 1, message: 'some text' });

        const res = await request({
            path: '/bodies/2/boards/' + board.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { message: 'a new text' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);

        const boardFromDB = await Board.findByPk(board.id);
        expect(boardFromDB).not.toEqual(null);
        expect(boardFromDB.message).toEqual('some text');
    });

    test('should keep the board in the URL body and ignore body_id in the request body', async () => {
        // no global permission to manage boards: the user manages body.id locally, but not 1337
        mock.mockAll({ mainPermissions: { viewOnly: true } });

        const board = await generator.createBoard({ body_id: body.id });

        const res = await request({
            path: '/bodies/' + body.id + '/boards/' + board.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { body_id: 1337, message: 'a new text' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.body_id).toEqual(body.id);

        const boardFromDB = await Board.findByPk(board.id);
        expect(boardFromDB.body_id).toEqual(body.id);
        expect(boardFromDB.message).toEqual('a new text');
    });

    test('should let a board manager of the body edit its board without the view permission', async () => {
        // The user manages body.id locally, but holds no global permission.
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const board = await generator.createBoard({ body_id: body.id, message: 'some text' });

        const res = await request({
            path: '/bodies/' + body.id + '/boards/' + board.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { message: 'a new text' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.message).toEqual('a new text');

        const boardFromDB = await Board.findByPk(board.id);
        expect(boardFromDB.message).toEqual('a new text');
    });

    test('should let a board manager of the body who holds the view permission edit its board', async () => {
        mock.mockAll({ mainPermissions: { viewOnly: true } });

        const board = await generator.createBoard({ body_id: body.id, message: 'some text' });

        const res = await request({
            path: '/bodies/' + body.id + '/boards/' + board.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { message: 'a new text' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.message).toEqual('a new text');
    });

    test('should not let a board manager edit a board of another body', async () => {
        mock.mockAll({ mainPermissions: { viewOnly: true } });

        // The user manages body.id locally; 1337 is not one of their bodies.
        const board = await generator.createBoard({ body_id: 1337, message: 'some text' });

        const res = await request({
            path: '/bodies/1337/boards/' + board.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { message: 'a new text' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);

        const boardFromDB = await Board.findByPk(board.id);
        expect(boardFromDB.message).toEqual('some text');
    });

    test('should not let a member with only the view permission edit a board', async () => {
        mock.mockAll({ mainPermissions: { viewOnly: true }, managePermissions: { noPermissions: true } });

        const board = await generator.createBoard({ body_id: body.id, message: 'some text' });

        const res = await request({
            path: '/bodies/' + body.id + '/boards/' + board.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { message: 'a new text' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);

        const boardFromDB = await Board.findByPk(board.id);
        expect(boardFromDB.message).toEqual('some text');
    });
});
