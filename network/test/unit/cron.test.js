const { Board } = require('../../models');
const boards = require('../../lib/boards');
const cron = require('../../lib/cron');

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

    test('sendAllEmails should fetch all boards and send emails', async () => {
        const mockBoards = [{ id: 1 }, { id: 2 }];
        Board.findAll.mockResolvedValue(mockBoards);

        await cron.sendAllEmails();

        expect(Board.findAll).toHaveBeenCalledTimes(1);
        expect(boards.sendNewBoardEmail).toHaveBeenCalledTimes(mockBoards.length);
        expect(boards.sendNewBoardEmail).toHaveBeenCalledWith(1);
        expect(boards.sendNewBoardEmail).toHaveBeenCalledWith(2);
    });
});
