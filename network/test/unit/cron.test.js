const { Board } = require('../../models');
const boards = require('../../lib/boards');
const cron = require('../../lib/cron');

jest.mock('../../models');
jest.mock('../../lib/boards');

describe('Cron Job Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
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

    test('sendAllEmails should await all scheduled email sends', async () => {
        const completed = [];
        Board.findAll.mockResolvedValue([{ id: 1 }, { id: 2 }]);
        boards.sendNewBoardEmail.mockImplementation((id) => new Promise((resolve) => {
            setTimeout(() => {
                completed.push(id);
                resolve();
            }, 5);
        }));

        await cron.sendAllEmails();

        expect(completed).toEqual([1, 2]);
    });
});
