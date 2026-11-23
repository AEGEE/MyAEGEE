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

    describe('members of the board', () => {
        test('should fail with 422 if core does not know an officer the request leaves unchanged', async () => {
            mock.mockAll({ member: { notFound: [404] } });
            const board = await generator.createBoard({ president: 1, secretary: 404, treasurer: 2, message: 'some text' });

            const res = await request({
                path: '/bodies/' + board.body_id + '/boards/' + board.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { message: 'a new text' }
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(res.body.errors).toEqual({ secretary: ['The member is not found.'] });

            const boardFromDB = await Board.findByPk(board.id);
            expect(boardFromDB.message).toEqual('some text');
        });

        test('should fail with 422 if core does not know the officer the request sets', async () => {
            mock.mockAll({ member: { notFound: [404] } });
            const board = await generator.createBoard({ president: 1, secretary: 2, treasurer: 3 });

            const res = await request({
                path: '/bodies/' + board.body_id + '/boards/' + board.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { president: 404 }
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toEqual({ president: ['The member is not found.'] });

            const boardFromDB = await Board.findByPk(board.id);
            expect(boardFromDB.president).toEqual(1);
        });

        test('should fail with 422 if core does not know the member of another position', async () => {
            mock.mockAll({ member: { notFound: [99] } });
            const board = await generator.createBoard({ president: 1, secretary: 2, treasurer: 3 });

            const res = await request({
                path: '/bodies/' + board.body_id + '/boards/' + board.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { other_members: [{ function: 'Comms', user_id: 99 }] }
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toEqual({ other_members: ['The member of the position Comms is not found.'] });

            const boardFromDB = await Board.findByPk(board.id);
            expect(boardFromDB.other_members).toEqual(null);
        });

        test('should fail with 422 for a stored position without a member the request leaves unchanged', async () => {
            const board = await generator.createBoard({ other_members: [{ function: 'Comms' }], message: 'some text' }, { validate: false });

            const res = await request({
                path: '/bodies/' + board.body_id + '/boards/' + board.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { message: 'a new text' }
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toEqual({ other_members: ['Other members should be a list of positions, each with a function and a member.'] });

            const boardFromDB = await Board.findByPk(board.id);
            expect(boardFromDB.message).toEqual('some text');
        });

        test('should save the board if core knows every member', async () => {
            const board = await generator.createBoard({
                president: 1,
                secretary: 2,
                treasurer: 3,
                other_members: [{ function: 'Comms', user_id: 4 }]
            });

            const res = await request({
                path: '/bodies/' + board.body_id + '/boards/' + board.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { president: 5, message: 'a new text' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.president).toEqual(5);

            const boardFromDB = await Board.findByPk(board.id);
            expect(boardFromDB.president).toEqual(5);
            expect(boardFromDB.message).toEqual('a new text');
        });

        test('should fail with 500 and keep the board if core fails to answer for a member', async () => {
            mock.mockAll({ member: { netError: true } });
            const board = await generator.createBoard({ message: 'some text' });

            const res = await request({
                path: '/bodies/' + board.body_id + '/boards/' + board.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { message: 'a new text' }
            });

            expect(res.statusCode).toEqual(500);
            expect(res.body.success).toEqual(false);

            const boardFromDB = await Board.findByPk(board.id);
            expect(boardFromDB.message).toEqual('some text');
        });
    });
});
