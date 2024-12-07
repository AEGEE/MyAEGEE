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

        await sendNewBoardEmail(1, true);

        expect(Board.findByPk).toHaveBeenCalledWith(1);
        expect(mailer.sendMail).not.toHaveBeenCalled();
    });

    it('should not send email if not newBoard and start_date is not today', async () => {
        const board = { start_date: moment().subtract(1, 'day').toDate() };
        Board.findByPk.mockResolvedValue(board);

        await sendNewBoardEmail(1, false);

        expect(Board.findByPk).toHaveBeenCalledWith(1);
        expect(mailer.sendMail).not.toHaveBeenCalled();
    });

    it('should not send email if newBoard is undefined and start_date is not today', async () => {
        const board = { start_date: moment().subtract(1, 'day').toDate() };
        Board.findByPk.mockResolvedValue(board);

        await sendNewBoardEmail(1);

        expect(Board.findByPk).toHaveBeenCalledWith(1);
        expect(mailer.sendMail).not.toHaveBeenCalled();
    });

    it('should not send email if newBoard and end_date is before today', async () => {
        const board = { end_date: moment().subtract(1, 'day').toDate() };
        Board.findByPk.mockResolvedValue(board);

        await sendNewBoardEmail(1, true);

        expect(Board.findByPk).toHaveBeenCalledWith(1);
        expect(mailer.sendMail).not.toHaveBeenCalled();
    });

    it('should send email with correct parameters', async () => {
        const board = {
            start_date: moment().toDate(),
            end_date: moment().add(1, 'day').toDate(),
            president: 1,
            secretary: 2,
            treasurer: 3,
            other_members: [{ user_id: 4 }, { user_id: 5 }]
        };
        const mails = [
            { notification_email: 'president@example.com' },
            { notification_email: 'secretary@example.com' },
            { notification_email: 'treasurer@example.com' },
            { notification_email: 'member1@example.com' },
            { notification_email: 'member2@example.com' }
        ];
        Board.findByPk.mockResolvedValue(board);
        core.getMails.mockResolvedValue(mails);

        await sendNewBoardEmail(1, true);

        expect(Board.findByPk).toHaveBeenCalledWith(1);
        expect(core.getMails).toHaveBeenCalledWith('1,2,3,4,5');
        expect(mailer.sendMail).toHaveBeenCalledWith({
            to: mails.map((member) => member.notification_email),
            subject: constants.MAIL_SUBJECTS.NEW_BOARD_EMAIL,
            template: 'network_board_welcome.html',
            parameters: {}
        });
    });
});
