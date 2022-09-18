const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock');
const generator = require('../scripts/generator');

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
            uri: '/bodies/' + board.body_id + '/boards/' + board.id,
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
            uri: '/bodies/' + board.body_id + '/boards/' + board.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                message: 'a new text'
            }
        });

        const res = await request({
            uri: '/bodies/' + board.body_id + '/boards/' + board.id,
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
});
