const moment = require('moment');

const { sequelize } = require('../../lib/sequelize');
const cron = require('../../lib/cron');
const boards = require('../../lib/boards');
const mailer = require('../../lib/mailer');
const logger = require('../../lib/logger');
const constants = require('../../lib/constants');
const migration = require('../../migrations/20261121120000-add-board-new-board-email-sent-at');
const mock = require('../scripts/mock');
const generator = require('../scripts/generator');

const daysAgo = (days) => moment().subtract(days, 'days').format('YYYY-MM-DD');

describe('New board emails', () => {
    let sendMailSpy;

    beforeEach(() => {
        mock.mockAll();
        sendMailSpy = jest.spyOn(mailer, 'sendMail');
    });

    afterEach(async () => {
        jest.restoreAllMocks();
        await generator.clearAll();
        mock.cleanAll();
    });

    afterAll(() => {
        cron.job.stop();
    });

    test('should send unsent boards and mark them as sent', async () => {
        const board = await generator.createBoard({ start_date: daysAgo(0) });
        const lateBoard = await generator.createBoard({ start_date: daysAgo(constants.NEW_BOARD_EMAIL_MAX_AGE_DAYS) });

        await cron.sendAllEmails();

        expect(sendMailSpy).toHaveBeenCalledTimes(2);
        expect((await board.reload()).new_board_email_sent_at).not.toBeNull();
        expect((await lateBoard.reload()).new_board_email_sent_at).not.toBeNull();
    });

    test('should skip boards that already got the email', async () => {
        await generator.createBoard({ start_date: daysAgo(1), new_board_email_sent_at: new Date() });

        await cron.sendAllEmails();

        expect(sendMailSpy).not.toHaveBeenCalled();
    });

    test('should skip boards that start in the future, started too long ago or already ended', async () => {
        const futureBoard = await generator.createBoard({ start_date: moment().add(1, 'day').format('YYYY-MM-DD') });
        const oldBoard = await generator.createBoard({ start_date: daysAgo(constants.NEW_BOARD_EMAIL_MAX_AGE_DAYS + 1) });
        const endedBoard = await generator.createBoard({ start_date: daysAgo(3), end_date: daysAgo(1) });

        await cron.sendAllEmails();

        expect(sendMailSpy).not.toHaveBeenCalled();
        expect((await futureBoard.reload()).new_board_email_sent_at).toBeNull();
        expect((await oldBoard.reload()).new_board_email_sent_at).toBeNull();
        expect((await endedBoard.reload()).new_board_email_sent_at).toBeNull();
    });

    test('should leave a failed board unmarked and retry it on the next run', async () => {
        jest.spyOn(logger, 'error').mockImplementation(() => {});
        const failedBoard = await generator.createBoard({ start_date: daysAgo(1) });
        const otherBoard = await generator.createBoard({ start_date: daysAgo(1) });
        const sendNewBoardEmail = jest.spyOn(boards, 'sendNewBoardEmail').mockImplementation(async (id) => {
            if (id === failedBoard.id) throw new Error('mailer is down');
        });

        await cron.sendAllEmails();

        expect(sendNewBoardEmail).toHaveBeenCalledTimes(2);
        expect((await failedBoard.reload()).new_board_email_sent_at).toBeNull();
        expect((await otherBoard.reload()).new_board_email_sent_at).not.toBeNull();

        sendNewBoardEmail.mockRestore();
        await cron.sendAllEmails();

        expect(sendMailSpy).toHaveBeenCalledTimes(1);
        expect((await failedBoard.reload()).new_board_email_sent_at).not.toBeNull();
    });
});

describe('new_board_email_sent_at migration', () => {
    const queryInterface = sequelize.getQueryInterface();

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should mark existing boards that already started as sent', async () => {
        // The backfill compares with the database date, which is in UTC.
        const utcDay = (days) => moment.utc().add(days, 'days').format('YYYY-MM-DD');
        const pastBoard = await generator.createBoard({ start_date: utcDay(-30) });
        const todayBoard = await generator.createBoard({ start_date: utcDay(0) });
        const futureBoard = await generator.createBoard({ start_date: utcDay(1) });

        await migration.down(queryInterface);
        await migration.up(queryInterface, sequelize.constructor);

        expect((await pastBoard.reload()).new_board_email_sent_at).not.toBeNull();
        expect((await todayBoard.reload()).new_board_email_sent_at).not.toBeNull();
        expect((await futureBoard.reload()).new_board_email_sent_at).toBeNull();
    });
});
