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

    test('should change only the board fields of the request', async () => {
        const board = await generator.createBoard({ body_id: body.id });

        const res = await request({
            path: '/bodies/' + body.id + '/boards/' + board.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { id: 999999, new_board_email_sent_at: '2020-01-01T00:00:00.000Z', message: 'a new text' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.id).toEqual(board.id);
        expect(res.body.data.new_board_email_sent_at).toEqual(null);

        const boardFromDB = await Board.findByPk(board.id);
        expect(boardFromDB.new_board_email_sent_at).toEqual(null);
        expect(boardFromDB.message).toEqual('a new text');
        expect(await Board.findByPk(999999)).toEqual(null);
    });

    test('should fail if end_date is before start_date', async () => {
        const board = await generator.createBoard({ body_id: body.id, start_date: '2026-01-10' });

        const res = await request({
            path: '/bodies/' + body.id + '/boards/' + board.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { start_date: '2026-01-10', end_date: '2026-01-09' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.errors).toHaveProperty('end_date');

        const boardFromDB = await Board.findByPk(board.id);
        expect(boardFromDB.end_date).toEqual(null);
    });

    describe('members of the board', () => {
        test('should save a board whose officer core no longer knows, if the request leaves it in place', async () => {
            mock.mockAll({ member: { notFound: [404] } });
            const board = await generator.createBoard({ president: 1, secretary: 404, treasurer: 2, message: 'some text' });

            const res = await request({
                path: '/bodies/' + board.body_id + '/boards/' + board.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { secretary: 404, message: 'a new text' }
            });

            expect(res.statusCode).toEqual(200);

            const boardFromDB = await Board.findByPk(board.id);
            expect(boardFromDB.secretary).toEqual(404);
            expect(boardFromDB.message).toEqual('a new text');
        });

        test('should look up a stored member who moves to another position', async () => {
            mock.mockAll({ member: { notFound: [404] } });
            const board = await generator.createBoard({ president: 1, secretary: 2, treasurer: 404 });

            const res = await request({
                path: '/bodies/' + board.body_id + '/boards/' + board.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { president: 404, treasurer: 1 }
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toEqual({ president: ['The member is not found.'] });

            const boardFromDB = await Board.findByPk(board.id);
            expect(boardFromDB.president).toEqual(1);
            expect(boardFromDB.treasurer).toEqual(404);
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
            const board = await generator.createBoard({ president: 1, message: 'some text' });

            const res = await request({
                path: '/bodies/' + board.body_id + '/boards/' + board.id,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { president: 7, message: 'a new text' }
            });

            expect(res.statusCode).toEqual(500);
            expect(res.body.success).toEqual(false);

            const boardFromDB = await Board.findByPk(board.id);
            expect(boardFromDB.message).toEqual('some text');
        });
    });

    // An old board keeps its former members: people who have left the body, whom a board
    // manager of the body may no longer see in core (core answers 403), or whose account
    // is gone (404). Only the members a request adds or changes are looked up.
    describe.each([
        ['a board manager of the body', { mainPermissions: { viewOnly: true } }],
        ['a global board manager', {}]
    ])('a board with former members, edited by %s', (_, permissions) => {
        const FORMER = 403;
        const DELETED = 404;

        beforeEach(() => {
            mock.mockAll({ ...permissions, member: { forbidden: [FORMER], notFound: [DELETED] } });
        });

        const createOldBoard = () => generator.createBoard({
            body_id: body.id,
            president: FORMER,
            secretary: 2,
            treasurer: DELETED,
            other_members: [{ function: 'Comms', user_id: FORMER }],
            message: 'some text'
        });

        const edit = (board, fields) => request({
            path: '/bodies/' + body.id + '/boards/' + board.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: fields
        });

        test('should save the board unchanged, as the edit dialog sends it', async () => {
            const board = await createOldBoard();

            const res = await edit(board, {
                body_id: body.id,
                elected_date: board.elected_date,
                start_date: board.start_date,
                end_date: null,
                president: FORMER,
                secretary: 2,
                treasurer: DELETED,
                other_members: [{ function: 'Comms', user_id: FORMER }],
                name: null,
                message: 'some text'
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toMatchObject({ president: FORMER, treasurer: DELETED, other_members: [{ function: 'Comms', user_id: FORMER }] });
        });

        test('should save a change of the message only', async () => {
            const board = await createOldBoard();

            const res = await edit(board, { message: 'a new text' });

            expect(res.statusCode).toEqual(200);
            expect((await Board.findByPk(board.id)).message).toEqual('a new text');
        });

        test('should keep another member whose function changes', async () => {
            const board = await createOldBoard();

            const res = await edit(board, { other_members: [{ function: 'Communications', user_id: FORMER }] });

            expect(res.statusCode).toEqual(200);
            expect((await Board.findByPk(board.id)).other_members).toEqual([{ function: 'Communications', user_id: FORMER }]);
        });

        test('should save a secretary replaced by a member core knows', async () => {
            const board = await createOldBoard();

            const res = await edit(board, { secretary: 5 });

            expect(res.statusCode).toEqual(200);
            expect((await Board.findByPk(board.id)).secretary).toEqual(5);
        });

        test('should refuse an unknown member added to another position', async () => {
            const board = await createOldBoard();

            const res = await edit(board, { other_members: [{ function: 'Comms', user_id: FORMER }, { function: 'PR', user_id: DELETED }] });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toEqual({ other_members: ['The member of the position PR is not found.'] });
            expect((await Board.findByPk(board.id)).other_members).toEqual([{ function: 'Comms', user_id: FORMER }]);
        });
    });
});
