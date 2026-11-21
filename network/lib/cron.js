const moment = require('moment');
const { Op } = require('sequelize');
const { CronJob } = require('cron');
const { Board } = require('../models');
const boards = require('./boards');
const constants = require('./constants');
const logger = require('./logger');

module.exports.sendAllEmails = async () => {
    const today = moment().format('YYYY-MM-DD');
    const oldestStartDate = moment().subtract(constants.NEW_BOARD_EMAIL_MAX_AGE_DAYS, 'days').format('YYYY-MM-DD');

    const unsentBoards = await Board.findAll({
        where: {
            start_date: { [Op.between]: [oldestStartDate, today] },
            [Op.or]: [
                { end_date: { [Op.gte]: today } },
                { end_date: null }
            ],
            new_board_email_sent_at: null
        }
    });
    for (const board of unsentBoards) {
        try {
            await boards.sendNewBoardEmail(board.id);
            await board.update({ new_board_email_sent_at: new Date() });
        } catch (err) {
            logger.error({ err, board_id: board.id }, 'Could not send new board email');
        }
    }
};

module.exports.job = new CronJob('0 10 * * *', async () => {
    await module.exports.sendAllEmails();
}, null, true, 'Europe/Brussels');
