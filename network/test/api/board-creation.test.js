const http = require('http');
const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock');
const generator = require('../scripts/generator');
const { Board } = require('../../models');
const mailer = require('../../lib/mailer');
const config = require('../../config');
const cron = require('../../lib/cron');
const logger = require('../../lib/logger');
const body = require('../assets/core-local.json').data;
const user = require('../assets/core-valid.json').data;

describe('Board creation', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        cron.job.stop();
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll();
    });

    afterEach(async () => {
        mock.cleanAll();
        await generator.clearAll();
    });

    test('should fail if no permissions', async () => {
        mock.mockAll({
            mainPermissions: { noPermissions: true },
            managePermissions: { noPermissions: true }
        });

        const board = generator.generateBoard();

        const res = await request({
            path: '/bodies/' + body.id + '/boards',
            method: 'POST',
            body: board,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
    });

    test('should fail if body_id is not a number', async () => {
        const board = generator.generateBoard();

        const res = await request({
            path: '/bodies/lalala/boards',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: board
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body.message).toEqual('Body ID is invalid.');
    });

    test('should check the permission against the body in the URL', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        // body.id is managed through the local permissions, 1337 is not
        const board = generator.generateBoard({ body_id: body.id });

        const res = await request({
            path: '/bodies/1337/boards',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: board
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
    });

    test('should store the body in the URL and ignore body_id in the request body', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const board = generator.generateBoard({ body_id: 1337 });

        const res = await request({
            path: '/bodies/' + body.id + '/boards',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: board
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.body_id).toEqual(body.id);

        const boardFromDB = await Board.findOne({ where: { president: board.president } });
        expect(boardFromDB.body_id).toEqual(body.id);
    });

    test('should store only the board fields of the request', async () => {
        const board = generator.generateBoard({
            id: 999999,
            start_date: moment().add(1, 'week').format('YYYY-MM-DD'),
            new_board_email_sent_at: '2020-01-01T00:00:00.000Z',
            created_at: '2020-01-01T00:00:00.000Z'
        });

        const res = await request({
            path: '/bodies/' + body.id + '/boards',
            method: 'POST',
            body: board,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.id).not.toEqual(999999);
        expect(res.body.data.new_board_email_sent_at).toEqual(null);
        expect(res.body.data.created_at).not.toEqual('2020-01-01T00:00:00.000Z');
    });

    test('should fail if elected_date is not set', async () => {
        const board = generator.generateBoard({ elected_date: null });

        const res = await request({
            path: '/bodies/' + body.id + '/boards',
            method: 'POST',
            body: board,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('elected_date');
    });

    test('should fail if elected_date is in the future', async () => {
        const board = generator.generateBoard({ elected_date: moment().add(30, 'days').format('YYYY-MM-DD') });

        const res = await request({
            path: '/bodies/' + body.id + '/boards',
            method: 'POST',
            body: board,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('elected_date');
    });

    test('should accept a board elected today whose term starts today', async () => {
        const today = moment().format('YYYY-MM-DD');
        const board = generator.generateBoard({ elected_date: today, start_date: today });

        const res = await request({
            path: '/bodies/' + body.id + '/boards',
            method: 'POST',
            body: board,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.elected_date).toEqual(today);
        expect(res.body.data.start_date).toEqual(today);
    });

    test('should fail if elected_date is tomorrow', async () => {
        const board = generator.generateBoard({ elected_date: moment().add(1, 'day').format('YYYY-MM-DD') });

        const res = await request({
            path: '/bodies/' + body.id + '/boards',
            method: 'POST',
            body: board,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.errors).toHaveProperty('elected_date');
    });

    test('should fail if start_date is not set', async () => {
        const board = generator.generateBoard({ start_date: null });

        const res = await request({
            path: '/bodies/' + body.id + '/boards',
            method: 'POST',
            body: board,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('start_date');
    });

    test('should fail if end_date is in the past', async () => {
        const board = generator.generateBoard({ start_date: '2026-01-10', end_date: '2026-01-09' });

        const res = await request({
            path: '/bodies/' + body.id + '/boards',
            method: 'POST',
            body: board,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('end_date');
    });

    test('should fail if image_id is not a number', async () => {
        const board = generator.generateBoard({ image_id: 'NaN' });

        const res = await request({
            path: '/bodies/' + body.id + '/boards',
            method: 'POST',
            body: board,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('image_id');
    });

    test.each(['president', 'secretary', 'treasurer'])('should fail with 422 if the %s is not set', async (field) => {
        const board = generator.generateBoard({ [field]: null });

        const res = await request({
            path: '/bodies/' + body.id + '/boards',
            method: 'POST',
            body: board,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body.errors).toHaveProperty(field);
        expect(await Board.count()).toEqual(0);
    });

    test('should list every message of a field that fails two rules', async () => {
        const res = await request({
            path: '/bodies/' + body.id + '/boards',
            method: 'POST',
            body: generator.generateBoard({ president: '' }),
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.errors).toEqual({ president: ['President should be selected.', 'President should be a number.'] });
    });

    test('should fail with 422 if the president is not a number', async () => {
        const board = generator.generateBoard({ president: 'abc' });

        const res = await request({
            path: '/bodies/' + body.id + '/boards',
            method: 'POST',
            body: board,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.errors).toHaveProperty('president');
    });

    test.each([
        ['not a list', 'x'],
        ['a list of strings', ['x']],
        ['a member without a user', [{ function: 'Comms' }]],
        ['a member without a function', [{ user_id: 1 }]],
        ['a member with a user that is not a number', [{ function: 'Comms', user_id: 'abc' }]]
    ])('should fail with 422 if other_members is %s', async (_, otherMembers) => {
        const board = generator.generateBoard({ other_members: otherMembers });

        const res = await request({
            path: '/bodies/' + body.id + '/boards',
            method: 'POST',
            body: board,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.errors).toHaveProperty('other_members');
        expect(await Board.count()).toEqual(0);
    });

    test('should fail with 404 if core does not know the body', async () => {
        mock.mockAll({ body: { notFound: true } });
        const board = generator.generateBoard();

        const res = await request({
            path: '/bodies/' + body.id + '/boards',
            method: 'POST',
            body: board,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(await Board.count()).toEqual(0);
    });

    test('should fail with 422 if core does not know an officer', async () => {
        mock.mockAll({ member: { notFound: [404] } });
        const board = generator.generateBoard({ president: 1, secretary: 404, treasurer: 2 });

        const res = await request({
            path: '/bodies/' + body.id + '/boards',
            method: 'POST',
            body: board,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(Object.keys(res.body.errors)).toEqual(['secretary']);
        expect(await Board.count()).toEqual(0);
    });

    test('should fail with 422 if core does not know one of the other members', async () => {
        mock.mockAll({ member: { notFound: [99] } });
        const board = generator.generateBoard({ other_members: [{ function: 'Comms', user_id: 99 }] });

        const res = await request({
            path: '/bodies/' + body.id + '/boards',
            method: 'POST',
            body: board,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(Object.keys(res.body.errors)).toEqual(['other_members']);
        expect(await Board.count()).toEqual(0);
    });

    test('should fail if core user request returns net error', async () => {
        mock.mockAll({ member: { netError: true } });
        const board = generator.generateBoard({ president: user.id });

        const res = await request({
            path: '/bodies/' + body.id + '/boards',
            method: 'POST',
            body: board,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if core user request returns garbage', async () => {
        mock.mockAll({ member: { badResponse: true } });
        const board = generator.generateBoard({ president: user.id });

        const res = await request({
            path: '/bodies/' + body.id + '/boards',
            method: 'POST',
            body: board,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if core user request returns unsuccessful response', async () => {
        mock.mockAll({ member: { unsuccessfulResponse: true } });
        const board = generator.generateBoard({ president: user.id });

        const res = await request({
            path: '/bodies/' + body.id + '/boards',
            method: 'POST',
            body: board,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if core body request returns net error', async () => {
        mock.mockAll({ body: { netError: true } });
        const board = generator.generateBoard({ body_id: body.id });

        const res = await request({
            path: '/bodies/' + body.id + '/boards',
            method: 'POST',
            body: board,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if core body request returns garbage', async () => {
        mock.mockAll({ body: { badResponse: true } });
        const board = generator.generateBoard({ body_id: body.id });

        const res = await request({
            path: '/bodies/' + body.id + '/boards',
            method: 'POST',
            body: board,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if core body request returns unsuccessful response', async () => {
        mock.mockAll({ body: { unsuccessfulResponse: true } });
        const board = generator.generateBoard({ body_id: body.id });

        const res = await request({
            path: '/bodies/' + body.id + '/boards',
            method: 'POST',
            body: board,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed if everything is okay', async () => {
        const board = generator.generateBoard({});

        const res = await request({
            path: '/bodies/' + body.id + '/boards',
            method: 'POST',
            body: board,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data).toHaveProperty('elected_date');
        expect(res.body.data).toHaveProperty('start_date');
        expect(res.body.data).toHaveProperty('president');
        expect(res.body.data).toHaveProperty('secretary');
        expect(res.body.data).toHaveProperty('treasurer');
        expect(res.body.data.other_members).toEqual(null);
    });

    test('should return the created board with its id', async () => {
        const board = generator.generateBoard({ name: 'Board 2026' });

        const res = await request({
            path: '/bodies/' + body.id + '/boards',
            method: 'POST',
            body: board,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);

        const boardFromDB = await Board.findOne({ where: { name: 'Board 2026' } });
        expect(res.body.data.id).toEqual(boardFromDB.id);
        expect(res.body.data.body_id).toEqual(body.id);
        expect(res.body.data).toHaveProperty('created_at');
        expect(res.body.data).toHaveProperty('updated_at');
    });

    test('should succeed for more positions if everything is okay', async () => {
        const board = generator.generateBoard({ other_members: [{ function: 'Test', user_id: user.id }] });

        const res = await request({
            path: '/bodies/' + body.id + '/boards',
            method: 'POST',
            body: board,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data).toHaveProperty('other_members');
        expect(res.body.data.other_members[0].function).toEqual('Test');
        expect(res.body.data.other_members[0].user_id).toEqual(user.id);
    });

    test('should fail with 422 if the request has no body', async () => {
        const res = await request({
            path: '/bodies/' + body.id + '/boards',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.errors).toHaveProperty('president');
        expect(await Board.count()).toEqual(0);
    });

    test('should tell NetCom about the new board', async () => {
        const sendMailSpy = jest.spyOn(mailer, 'sendMail');
        const board = generator.generateBoard({ other_members: [{ function: 'Comms', user_id: user.id }] });

        try {
            const res = await request({
                path: '/bodies/' + body.id + '/boards',
                method: 'POST',
                body: board,
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);

            const notifications = sendMailSpy.mock.calls.filter(([options]) => options.template === 'network_new_board.html');
            expect(notifications.length).toEqual(1);
            const name = user.first_name + ' ' + user.last_name;
            expect(notifications[0][0]).toMatchObject({
                to: config.new_board_notifications,
                parameters: {
                    body_name: body.name,
                    positions: [
                        { function: 'President', name },
                        { function: 'Secretary', name },
                        { function: 'Treasurer', name },
                        { function: 'Comms', name }
                    ]
                }
            });
            expect(notifications[0][0].parameters.board).toMatchObject({ body_id: body.id, president: board.president });
        } finally {
            sendMailSpy.mockRestore();
        }
    });

    describe('welcome mail', () => {
        const daysFromNow = (days) => moment().add(days, 'days').format('YYYY-MM-DD');
        let sendMailSpy;
        const welcomeMails = () => sendMailSpy.mock.calls.filter(([options]) => options.template === 'network_board_welcome.html');

        beforeEach(() => {
            sendMailSpy = jest.spyOn(mailer, 'sendMail');
        });

        afterEach(() => {
            sendMailSpy.mockRestore();
        });

        const createBoard = (options) => request({
            path: '/bodies/' + body.id + '/boards',
            method: 'POST',
            body: generator.generateBoard(options),
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        test('should send it and mark the board if the term has started', async () => {
            const res = await createBoard({ start_date: daysFromNow(0) });

            expect(res.statusCode).toEqual(200);
            expect(welcomeMails()).toHaveLength(1);
            const board = await Board.findOne({ where: { body_id: body.id } });
            expect(board.new_board_email_sent_at).not.toBeNull();

            await cron.sendAllEmails();

            expect(welcomeMails()).toHaveLength(1);
        });

        test('should still create the board if the welcome mail fails, and leave it for the daily job', async () => {
            sendMailSpy.mockImplementation(async (options) => {
                if (options.template === 'network_board_welcome.html') {
                    throw new Error('Mailer is down');
                }
            });

            const res = await createBoard({ start_date: daysFromNow(0) });

            expect(res.statusCode).toEqual(200);
            const board = await Board.findOne({ where: { body_id: body.id } });
            expect(board).not.toBeNull();
            expect(board.new_board_email_sent_at).toBeNull();
        });

        test('should not send it or mark the board if the term starts in the future', async () => {
            const res = await createBoard({ start_date: daysFromNow(1) });

            expect(res.statusCode).toEqual(200);
            expect(welcomeMails()).toHaveLength(0);
            const board = await Board.findOne({ where: { body_id: body.id } });
            expect(board.new_board_email_sent_at).toBeNull();
        });

        test('should not send it if the term has ended', async () => {
            const res = await createBoard({ start_date: daysFromNow(-10), end_date: daysFromNow(-1) });

            expect(res.statusCode).toEqual(200);
            expect(welcomeMails()).toHaveLength(0);
            const board = await Board.findOne({ where: { body_id: body.id } });
            expect(board.new_board_email_sent_at).toBeNull();
        });
    });

    describe('mail to NetCom', () => {
        let errorSpy;
        const netcomMailErrors = () => errorSpy.mock.calls.filter(([, message]) => message === 'Could not send the new board mail to NetCom');

        beforeEach(() => {
            errorSpy = jest.spyOn(logger, 'error');
        });

        afterEach(() => {
            errorSpy.mockRestore();
        });

        const createBoard = () => request({
            path: '/bodies/' + body.id + '/boards',
            method: 'POST',
            body: generator.generateBoard({ start_date: moment().add(1, 'days').format('YYYY-MM-DD') }),
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        test('should send it with the new board', async () => {
            const sendMailSpy = jest.spyOn(mailer, 'sendMail');

            try {
                const res = await createBoard();

                expect(res.statusCode).toEqual(200);
                const netcomMails = sendMailSpy.mock.calls.filter(([options]) => options.template === 'network_new_board.html');
                expect(netcomMails).toHaveLength(1);
                expect(netcomMails[0][0].to).toEqual(config.new_board_notifications);
            } finally {
                sendMailSpy.mockRestore();
            }
        });

        test('should still create the board if the mailer fails, and log the failure without personal data', async () => {
            mock.cleanAll();
            mock.mockAll({ mailer: { unsuccessfulResponse: true } });

            const res = await createBoard();

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            const board = await Board.findByPk(res.body.data.id);
            expect(board).not.toBeNull();

            expect(netcomMailErrors()).toHaveLength(1);
            const [logged] = netcomMailErrors()[0];
            expect(Object.keys(logged).sort()).toEqual(['board_id', 'err']);
            expect(logged.board_id).toEqual(board.id);
            expect(logged.err.message).toEqual('Unsuccessful response from mailer (status 500)');
        });

        test('should still create the board if the mailer does not answer in time', async () => {
            // A local mailer that accepts the request and never answers.
            const server = http.createServer(() => {});
            await new Promise((resolve) => { server.listen(0, '127.0.0.1', resolve); });
            const { url, port, timeout } = config.mailer;

            try {
                config.mailer.url = 'http://127.0.0.1';
                config.mailer.port = server.address().port;
                config.mailer.timeout = 50;

                const res = await createBoard();

                expect(res.statusCode).toEqual(200);
                const board = await Board.findByPk(res.body.data.id);
                expect(board).not.toBeNull();
                expect(netcomMailErrors()).toHaveLength(1);
                expect(netcomMailErrors()[0][0].err.message).toEqual('The mailer did not answer within 50 ms');
            } finally {
                config.mailer.url = url;
                config.mailer.port = port;
                config.mailer.timeout = timeout;
                server.closeAllConnections();
                await new Promise((resolve) => { server.close(resolve); });
            }
        });
    });
});
