const { CronJob } = require('cron');
const { Board } = require('../models');
const boards = require('./boards');

module.exports.sendAllEmails = async () => {
    const allBoards = await Board.findAll({});
    for (const board of allBoards) {
        boards.sendNewBoardEmail(board.id);
    }
};

module.exports.job = new CronJob('0 10 * * *', async () => {
    await module.exports.sendAllEmails();
}, null, true, 'Europe/Brussels');
