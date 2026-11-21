const moment = require('moment');
const { sendNewBoardEmail } = require('../../lib/boards');
const { Board } = require('../../models');
const core = require('../../lib/core');
const mailer = require('../../lib/mailer');
const constants = require('../../lib/constants');

jest.mock('../../models');
jest.mock('../../lib/core');
jest.mock('../../lib/mailer');

describe('sendNewBoardEmail', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should not send email if board is not found', async () => {
        Board.findByPk.mockResolvedValue(null);

        await sendNewBoardEmail(1);

        expect(Board.findByPk).toHaveBeenCalledWith(1, { transaction: undefined });
        expect(mailer.sendMail).not.toHaveBeenCalled();
    });

    it('should not send email if start_date is after today', async () => {
        const board = { start_date: moment().add(1, 'day').toDate(), update: jest.fn() };
        Board.findByPk.mockResolvedValue(board);

        await sendNewBoardEmail(1);

        expect(mailer.sendMail).not.toHaveBeenCalled();
        expect(board.update).not.toHaveBeenCalled();
    });

    it('should send email for a board that started before today', async () => {
        const board = {
            start_date: moment().subtract(1, 'day').toDate(),
            president: 1,
            secretary: 2,
            treasurer: 3,
            update: jest.fn()
        };
        Board.findByPk.mockResolvedValue(board);
        core.getMails.mockResolvedValue([{ notification_email: 'president@example.com' }]);

        await sendNewBoardEmail(1);

        expect(core.getMails).toHaveBeenCalledWith('1,2,3');
        expect(mailer.sendMail).toHaveBeenCalledTimes(1);
    });

    it('should not send email if end_date is before today', async () => {
        const board = {
            start_date: moment().subtract(2, 'day').toDate(),
            end_date: moment().subtract(1, 'day').toDate(),
            update: jest.fn()
        };
        Board.findByPk.mockResolvedValue(board);

        await sendNewBoardEmail(1);

        expect(mailer.sendMail).not.toHaveBeenCalled();
        expect(board.update).not.toHaveBeenCalled();
    });

    it('should send email with correct parameters', async () => {
        const board = {
            start_date: moment().toDate(),
            end_date: moment().add(1, 'day').toDate(),
            president: 1,
            secretary: 2,
            treasurer: 3,
            other_members: [{ user_id: 4 }, { user_id: 5 }],
            update: jest.fn()
        };
        const transaction = {};
        const mails = [
            { notification_email: 'president@example.com' },
            { notification_email: 'secretary@example.com' },
            { notification_email: 'treasurer@example.com' },
            { notification_email: 'member1@example.com' },
            { notification_email: 'member2@example.com' }
        ];
        Board.findByPk.mockResolvedValue(board);
        core.getMails.mockResolvedValue(mails);

        await sendNewBoardEmail(1, { transaction });

        expect(Board.findByPk).toHaveBeenCalledWith(1, { transaction });
        expect(core.getMails).toHaveBeenCalledWith('1,2,3,4,5');
        expect(mailer.sendMail).toHaveBeenCalledWith({
            to: mails.map((member) => member.notification_email),
            subject: constants.MAIL_SUBJECTS.NEW_BOARD_EMAIL,
            template: 'network_board_welcome.html',
            parameters: {}
        });
        expect(board.update).toHaveBeenCalledWith({ new_board_email_sent_at: expect.any(Date) }, { transaction });
    });
});
