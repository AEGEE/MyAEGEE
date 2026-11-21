const { CronJob } = require('cron');
const { Board } = require('../models');
const boards = require('./boards');
const logger = require('./logger');

module.exports.sendAllEmails = async () => {
    const allBoards = await Board.findAll({});
    for (const board of allBoards) {
        try {
            await boards.sendNewBoardEmail(board.id);
        } catch (err) {
            logger.error({ err, board_id: board.id }, 'Could not send new board email');
        }
    }
};

module.exports.job = new CronJob('0 10 * * *', async () => {
    await module.exports.sendAllEmails();
}, null, true, 'Europe/Brussels');
