const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock');
const generator = require('../scripts/generator');
const { Board, AntennaCriterion, Netcom, MailComponent } = require('../../models');

// Input that does not fit a column answers 422 with the field's message, never a
// database error. The largest INTEGER is 2147483647; IDs are never negative.
const TOO_LARGE = 2147483648;
const BODY_ID = 34;

describe('Column limits', () => {
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

    const createBoard = (fields) => request({
        path: '/bodies/' + BODY_ID + '/boards',
        method: 'POST',
        headers: { 'X-Auth-Token': 'blablabla' },
        body: generator.generateBoard({ body_id: BODY_ID, ...fields })
    });

    const updateBoard = async (fields) => {
        // Reloaded, so that unset columns read as null, as they come from the database.
        const board = await (await generator.createBoard({ body_id: BODY_ID, message: 'unchanged' })).reload();
        const res = await request({
            path: '/bodies/' + BODY_ID + '/boards/' + board.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: fields
        });
        return { res, board };
    };

    describe('Board', () => {
        test('should accept a name of 255 characters', async () => {
            const res = await createBoard({ name: 'n'.repeat(255) });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.name).toHaveLength(255);
        });

        test.each([
            ['POST', createBoard],
            ['PUT', async (fields) => (await updateBoard(fields)).res]
        ])('should refuse a name longer than its column on %s', async (_, send) => {
            const res = await send({ name: 'n'.repeat(256) });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toEqual({ name: ['Name should be at most 255 characters.'] });
            expect(await Board.count({ where: { name: 'n'.repeat(256) } })).toEqual(0);
        });

        test.each([
            ['elected_date', 'garbage', 'Election date should be a date (YYYY-MM-DD).'],
            ['elected_date', '2021-02-30', 'Election date should be a date (YYYY-MM-DD).'],
            ['start_date', 'garbage', 'Start date of the mandate should be a date (YYYY-MM-DD).'],
            ['start_date', '1', 'Start date of the mandate should be a date (YYYY-MM-DD).'],
            ['end_date', 'garbage', 'End date of the mandate should be a date (YYYY-MM-DD).'],
            ['end_date', '2999-13-01', 'End date of the mandate should be a date (YYYY-MM-DD).']
        ])('should refuse %s set to %p on PUT and leave the board unchanged', async (field, value, message) => {
            const { res, board } = await updateBoard({ [field]: value });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toEqual({ [field]: [message] });
            expect((await Board.findByPk(board.id))[field]).toEqual(board[field]);
        });

        test.each([
            ['elected_date', 'garbage'],
            ['start_date', 'garbage'],
            ['end_date', 'garbage']
        ])('should refuse %s set to %p on POST', async (field, value) => {
            const res = await createBoard({ [field]: value });

            expect(res.statusCode).toEqual(422);
            expect(Object.keys(res.body.errors)).toEqual([field]);
            expect(await Board.count()).toEqual(0);
        });

        test('should accept a timestamp as a date and store its day', async () => {
            const { res, board } = await updateBoard({ end_date: '2999-01-10T16:00:00.000Z' });

            expect(res.statusCode).toEqual(200);
            expect((await Board.findByPk(board.id)).end_date).toEqual('2999-01-10');
        });

        test.each([
            ['president', TOO_LARGE, 'President should be between 0 and 2147483647.'],
            ['secretary', -1, 'Secretary should be between 0 and 2147483647.'],
            ['treasurer', '99999999999999999999', 'Treasurer should be between 0 and 2147483647.'],
            ['image_id', TOO_LARGE, 'Image ID should be between 0 and 2147483647.']
        ])('should refuse %s set to %p on POST', async (field, value, message) => {
            const res = await createBoard({ [field]: value });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toEqual({ [field]: [message] });
            expect(await Board.count()).toEqual(0);
        });

        test.each([
            ['president', TOO_LARGE, 'President should be between 0 and 2147483647.'],
            ['image_id', TOO_LARGE, 'Image ID should be between 0 and 2147483647.'],
            ['other_members', [{ function: 'Comms', user_id: TOO_LARGE }], 'Other members should be a list of positions, each with a function and a member.']
        ])('should refuse %s set to %p on PUT', async (field, value, message) => {
            const { res, board } = await updateBoard({ [field]: value });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toEqual({ [field]: [message] });
            expect((await Board.findByPk(board.id))[field]).toEqual(board[field]);
        });

        test('should accept the largest ID', async () => {
            const { res } = await updateBoard({ president: 2147483647, image_id: 2147483647 });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.president).toEqual(2147483647);
            expect(res.body.data.image_id).toEqual(2147483647);
        });
    });

    describe('AntennaCriterion', () => {
        test.each([
            ['agora_id', 'Agora ID should be between 0 and 2147483647.'],
            ['body_id', 'Body ID should be between 0 and 2147483647.']
        ])('should refuse %s above the largest ID', async (field, message) => {
            const res = await request({
                path: '/antennaCriteria',
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { agora_id: 1, body_id: BODY_ID, antenna_criterion: 'events', value: 'true', [field]: TOO_LARGE }
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toEqual({ [field]: [message] });
            expect(await AntennaCriterion.count()).toEqual(0);
        });
    });

    describe('Netcom', () => {
        test.each([
            ['body_id', 'Body ID should be between 0 and 2147483647.'],
            ['netcom_id', 'NetCom ID should be between 0 and 2147483647.']
        ])('should refuse %s above the largest ID', async (field, message) => {
            const res = await request({
                path: '/netcom',
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { body_id: BODY_ID, netcom_id: 5, [field]: TOO_LARGE }
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toEqual({ [field]: [message] });
            expect(await Netcom.count()).toEqual(0);
        });
    });

    describe('MailComponent', () => {
        test('should refuse agora_id above the largest ID', async () => {
            const res = await request({
                path: '/mailComponent',
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { agora_id: TOO_LARGE, mail_component: 'closing', text: 'Text' }
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors).toEqual({ agora_id: ['Agora ID should be between 0 and 2147483647.'] });
            expect(await MailComponent.count()).toEqual(0);
        });
    });
});
