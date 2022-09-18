const moment = require('moment');
const { Op } = require('sequelize');

const { Board } = require('../models');
const errors = require('./errors');
const helpers = require('./helpers');
const { sequelize } = require('./sequelize');
const core = require('./core');
const mailer = require('./mailer');
const config = require('../config');

exports.createBoard = async (req, res) => {
    if (!req.permissions.manage_boards) {
        return errors.makeForbiddenError(res, 'You are not allowed to create boards.');
    }

    const bodyName = (await core.fetchBody(req.body, req.headers['x-auth-token'])).body_name;

    const positions = [];
    positions.push({ function: 'President', name: (await core.fetchUser(req.body.president, req.headers['x-auth-token'])).name });
    positions.push({ function: 'Secretary', name: (await core.fetchUser(req.body.secretary, req.headers['x-auth-token'])).name });
    positions.push({ function: 'Treasurer', name: (await core.fetchUser(req.body.treasurer, req.headers['x-auth-token'])).name });

    if (req.body.other_members) {
        for (const other of req.body.other_members) {
            positions.push({ function: other.function, name: (await core.fetchUser(other.user_id, req.headers['x-auth-token'])).name });
        }
    }

    await sequelize.transaction(async (t) => {
        await Board.create(req.body, { transaction: t });

        await mailer.sendMail({
            to: config.new_board_notifications,
            subject: `A new board was added for ${bodyName}`,
            template: 'network_new_board.html',
            parameters: {
                board: req.body,
                body_name: bodyName,
                positions
            }
        });
    });

    return res.json({
        success: true,
        data: req.body
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
            end_date: { [Op.gte]: today }
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
    const board = await Board.findOne({
        where: { id: Number(req.params.board_id) }
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
    if (!req.permissions.manage_boards) {
        return errors.makeForbiddenError(res, 'You are not allowed to update boards.');
    }

    await req.board.update(req.body);

    return res.json({
        success: true,
        data: req.board
    });
};

exports.deleteBoard = async (req, res) => {
    if (!req.permissions.manage_boards) {
        return errors.makeForbiddenError(res, 'You are not allowed to delete boards.');
    }

    await req.board.destroy();

    return res.json({
        success: true,
        data: req.board
    });
};
