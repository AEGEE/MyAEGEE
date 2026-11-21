const { Board } = require('../../models');
const boards = require('../../lib/boards');
const cron = require('../../lib/cron');
const logger = require('../../lib/logger');

jest.mock('../../models');
jest.mock('../../lib/boards');

describe('Cron Job Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        cron.job.stop();
    });

    test('should schedule the board email job daily at 10:00 Brussels time', () => {
        expect(cron.job.cronTime.source).toEqual('0 10 * * *');
        expect(cron.job.cronTime.timeZone).toEqual('Europe/Brussels');
        expect(cron.job.nextDate().toJSDate().getTime()).toBeGreaterThan(Date.now());
    });

    test('sendAllEmails should fetch unsent boards, send emails and mark them as sent', async () => {
        const mockBoards = [{ id: 1, update: jest.fn() }, { id: 2, update: jest.fn() }];
        Board.findAll.mockResolvedValue(mockBoards);

        await cron.sendAllEmails();

        expect(Board.findAll).toHaveBeenCalledTimes(1);
        expect(Board.findAll.mock.calls[0][0].where.new_board_email_sent_at).toBeNull();
        expect(boards.sendNewBoardEmail).toHaveBeenCalledTimes(mockBoards.length);
        expect(boards.sendNewBoardEmail).toHaveBeenCalledWith(1);
        expect(boards.sendNewBoardEmail).toHaveBeenCalledWith(2);
        for (const board of mockBoards) {
            expect(board.update).toHaveBeenCalledWith({ new_board_email_sent_at: expect.any(Date) });
        }
    });

    test('sendAllEmails should wait for each email before sending the next one', async () => {
        const events = [];
        Board.findAll.mockResolvedValue([{ id: 1, update: jest.fn() }, { id: 2, update: jest.fn() }]);
        boards.sendNewBoardEmail.mockImplementation(async (id) => {
            events.push(`start ${id}`);
            await new Promise((resolve) => { setImmediate(resolve); });
            events.push(`end ${id}`);
        });

        await cron.sendAllEmails();

        expect(events).toEqual(['start 1', 'end 1', 'start 2', 'end 2']);
    });

    test('sendAllEmails should log a failed email and continue with the other boards', async () => {
        const logSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
        const error = new Error('mailer is down');
        Board.findAll.mockResolvedValue([{ id: 1, update: jest.fn() }, { id: 2, update: jest.fn() }]);
        boards.sendNewBoardEmail.mockRejectedValueOnce(error).mockResolvedValueOnce();

        try {
            await expect(cron.sendAllEmails()).resolves.toBeUndefined();

            expect(boards.sendNewBoardEmail).toHaveBeenCalledTimes(2);
            expect(boards.sendNewBoardEmail).toHaveBeenLastCalledWith(2);
            expect(logSpy).toHaveBeenCalledWith({ err: error, board_id: 1 }, 'Could not send new board email');
        } finally {
            logSpy.mockRestore();
        }
    });
});
