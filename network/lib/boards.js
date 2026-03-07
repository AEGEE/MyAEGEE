const moment = require('moment');
const { Op } = require('sequelize');

const { Board } = require('../models');
const errors = require('./errors');
const helpers = require('./helpers');
const { Sequelize, sequelize } = require('./sequelize');
const core = require('./core');
const mailer = require('./mailer');
const config = require('../config');
const constants = require('./constants');

exports.createBoard = async (req, res) => {
    const bodyId = Number(req.params.body_id);
    if (Number.isNaN(bodyId)) {
        return errors.makeBadRequestError(res, 'Body ID is invalid.');
    }

    const boardData = {
        ...req.body,
        body_id: bodyId
    };

    if (!req.permissions.manage_boards[bodyId] && !req.permissions.manage_boards.global) {
        return errors.makeForbiddenError(res, 'You are not allowed to create boards.');
    }

    const bodyName = (await core.fetchBody(boardData, req.headers['x-auth-token'])).body_name;

    const positions = [];
    positions.push({ function: 'President', name: (await core.fetchUser(boardData.president, req.headers['x-auth-token'])).name });
    positions.push({ function: 'Secretary', name: (await core.fetchUser(boardData.secretary, req.headers['x-auth-token'])).name });
    positions.push({ function: 'Treasurer', name: (await core.fetchUser(boardData.treasurer, req.headers['x-auth-token'])).name });

    if (boardData.other_members) {
        for (const other of boardData.other_members) {
            positions.push({ function: other.function, name: (await core.fetchUser(other.user_id, req.headers['x-auth-token'])).name });
        }
    }

    await sequelize.transaction(async (t) => {
        const createdBoard = await Board.create(boardData, { transaction: t });

        await mailer.sendMail({
            to: config.new_board_notifications,
            subject: `A new board was added for ${bodyName}`,
            template: 'network_new_board.html',
            parameters: {
                board: boardData,
                body_name: bodyName,
                positions
            }
        });

        await this.sendNewBoardEmail(createdBoard.id, true);
    });

    return res.json({
        success: true,
        data: boardData
    });
};

exports.listAllBoards = async (req, res) => {
    if (!req.permissions.view_board) {
        return errors.makeForbiddenError(res, 'You are not allowed to list all boards.');
    }

    const boards = await Board.findAll({
        order: helpers.getSorting(req.query)
    });

    return res.json({
        success: true,
        data: boards
    });
};

exports.listMostRecentBoardsElected = async (req, res) => {
    if (!req.permissions.view_board) {
        return errors.makeForbiddenError(res, 'You are not allowed to list recently elected boards.');
    }

    let endDate = moment().endOf('day').toDate();
    if (req.query.ends) endDate = moment(req.query.ends, 'YYYY-MM-DD').endOf('day').toDate();

    const boards = await Board.findAll({
        where: {
            elected_date: { [Op.lte]: endDate },
        },
        group: 'body_id',
        attributes: [
            'body_id',
            [Sequelize.fn('MAX', Sequelize.col('elected_date')), 'latest_election']
        ]
    });

    return res.json({
        success: true,
        data: boards
    });
};

exports.listAllBoardsBody = async (req, res) => {
    if (!req.permissions.view_board) {
        return errors.makeForbiddenError(res, 'You are not allowed to list all boards of this body.');
    }

    if (!helpers.isNumber(req.params.body_id)) {
        return errors.makeBadRequestError(res, 'Body ID is invalid.');
    }
    const boards = await Board.findAll({
        where: { body_id: Number(req.params.body_id) },
        order: helpers.getSorting(req.query)
    });

    if (boards.length === 0) {
        return errors.makeNotFoundError(res, 'There are no boards for this body.');
    }

    return res.json({
        success: true,
        data: boards
    });
};

exports.listCurrentBoardBody = async (req, res) => {
    if (!req.permissions.view_board) {
        return errors.makeForbiddenError(res, 'You are not allowed to list the current board of this body.');
    }

    if (!helpers.isNumber(req.params.body_id)) {
        return errors.makeBadRequestError(res, 'Body ID is invalid.');
    }

    const today = moment().format('YYYY-MM-DD');

    const board = await Board.findAll({
        where: {
            body_id: Number(req.params.body_id),
            start_date: { [Op.lte]: today },
            [Op.or]: [
                { end_date: { [Op.gte]: today } },
                { end_date: null }
            ]
        },
        order: [['start_date', 'DESC']]
    });

    if (board.length === 0) {
        return errors.makeNotFoundError(res, 'There is no current board.');
    }

    return res.json({
        success: true,
        data: board
    });
};

exports.findBoard = async (req, res, next) => {
    if (!req.permissions.view_board) {
        return errors.makeForbiddenError(res, 'You are not allowed to find this board.');
    }

    if (!helpers.isNumber(req.params.board_id)) {
        return errors.makeBadRequestError(res, 'Board ID is invalid.');
    }

    if (!helpers.isNumber(req.params.body_id)) {
        return errors.makeBadRequestError(res, 'Body ID is invalid.');
    }

    const board = await Board.findOne({
        where: {
            id: Number(req.params.board_id),
            body_id: Number(req.params.body_id)
        }
    });

    if (!board) {
        return errors.makeNotFoundError(res, 'The board is not found.');
    }

    req.board = board;
    return next();
};

exports.getBoard = async (req, res) => {
    if (!req.permissions.view_board) {
        return errors.makeForbiddenError(res, 'You are not allowed to see this board.');
    }

    return res.json({
        success: true,
        data: req.board
    });
};

exports.updateBoard = async (req, res) => {
    if (!req.permissions.manage_boards[req.board.body_id] && !req.permissions.manage_boards.global) {
        return errors.makeForbiddenError(res, 'You are not allowed to update boards.');
    }

    await req.board.update(req.body);

    return res.json({
        success: true,
        data: req.board
    });
};

exports.deleteBoard = async (req, res) => {
    if (!req.permissions.manage_boards[req.board.body_id] && !req.permissions.manage_boards.global) {
        return errors.makeForbiddenError(res, 'You are not allowed to delete boards.');
    }

    await req.board.destroy();

    return res.json({
        success: true,
        data: req.board
    });
};

exports.sendNewBoardEmail = async (id, newBoard) => {
    const board = await Board.findByPk(id);

    if (!board) {
        return;
    }

    if (!newBoard && !moment(board.start_date).isSame(moment(), 'day')) {
        return;
    }

    if (newBoard && moment(board.end_date).isBefore(moment())) {
        return;
    }

    const memberIds = [board.president, board.secretary, board.treasurer];

    if (board.other_members) {
        memberIds.push(...board.other_members.map((member) => member.user_id));
    }

    const mails = await core.getMails(memberIds.join(','));

    await mailer.sendMail({
        to: mails.map((member) => member.notification_email),
        subject: constants.MAIL_SUBJECTS.NEW_BOARD_EMAIL,
        template: 'network_board_welcome.html',
        parameters: {}
    });
};
