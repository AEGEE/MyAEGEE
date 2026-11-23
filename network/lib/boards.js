const lodash = require('lodash');
const moment = require('moment');
const { Op } = require('sequelize');

const { Board } = require('../models');
const errors = require('./errors');
const helpers = require('./helpers');
const { Sequelize } = require('./sequelize');
const core = require('./core');
const mailer = require('./mailer');
const config = require('../config');
const constants = require('./constants');
const logger = require('./logger');

// The fields a board manager sets; the rest (id, the body, the welcome mail mark,
// timestamps) belongs to the service.
const BOARD_FIELDS = ['elected_date', 'start_date', 'end_date', 'name', 'president', 'secretary', 'treasurer', 'other_members', 'message', 'image_id'];
const pickBoardFields = (input) => lodash.pick(input || {}, BOARD_FIELDS);

const OFFICERS = [['president', 'President'], ['secretary', 'Secretary'], ['treasurer', 'Treasurer']];

// Looks up the members of a valid board in core: every member on creation, and on an edit
// those the edit adds or changes (see changedMembers). Returns the positions with the
// members' names, and the errors of the fields whose member core does not know.
const lookUpMembers = async (boardData, token) => {
    const positions = [];
    const fieldErrors = {};
    for (const [field, position] of OFFICERS.filter(([officer]) => officer in boardData)) {
        const member = await core.fetchUser(boardData[field], token);
        if (member) {
            positions.push({ function: position, name: member.name });
        } else {
            fieldErrors[field] = ['The member is not found.'];
        }
    }

    for (const other of boardData.other_members || []) {
        const member = await core.fetchUser(other.user_id, token);
        if (member) {
            positions.push({ function: other.function, name: member.name });
        } else {
            fieldErrors.other_members = ['The member of the position ' + other.function + ' is not found.'];
        }
    }

    return { positions, fieldErrors };
};

// The members of an edited board that are new or changed against the stored one. A board
// keeps its former members (people who have left the body, whom a board manager of the
// body may no longer see in core, or whose account is gone) until someone replaces them,
// so the members an edit leaves in place are not looked up. An officer is compared by
// position: a stored treasurer who becomes president is a changed president. Another
// member is compared by member only: one whose function text changes is unchanged.
const changedMembers = (stored, board) => {
    const changed = {};
    for (const [field] of OFFICERS) {
        if (Number(board[field]) !== stored[field]) {
            changed[field] = board[field];
        }
    }

    const storedOthers = (stored.other_members || []).map((other) => other.user_id);
    changed.other_members = (board.other_members || []).filter((other) => !storedOthers.includes(other.user_id));

    return changed;
};

exports.createBoard = async (req, res) => {
    if (!helpers.isNumber(req.params.body_id)) {
        return errors.makeBadRequestError(res, 'Body ID is invalid.');
    }

    const boardData = { ...pickBoardFields(req.body), body_id: Number(req.params.body_id) };

    if (!req.permissions.manage_boards[boardData.body_id] && !req.permissions.manage_boards.global) {
        return errors.makeForbiddenError(res, 'You are not allowed to create boards.');
    }

    // Check the input before asking core about the body and the members.
    await Board.build(boardData).validate();

    const token = req.headers['x-auth-token'];
    const coreBody = await core.fetchBody(boardData, token);
    if (!coreBody) {
        return errors.makeNotFoundError(res, 'The body is not found.');
    }
    const bodyName = coreBody.body_name;

    const { positions, fieldErrors } = await lookUpMembers(boardData, token);
    if (Object.keys(fieldErrors).length > 0) {
        return res.status(422).json({ success: false, errors: fieldErrors });
    }

    const createdBoard = await Board.create(boardData);

    // Best-effort, after the board is stored: a mailer that is down or slow does not
    // fail the creation. The log names the board only.
    try {
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
    } catch (err) {
        logger.error({ err, board_id: createdBoard.id }, 'Could not send the new board mail to NetCom');
    }

    // Best-effort: a failed welcome mail doesn't fail the creation. The board stays
    // unmarked, so the daily job retries it.
    try {
        await this.sendNewBoardEmail(createdBoard.id);
    } catch (err) {
        logger.error({ err, board_id: createdBoard.id }, 'Could not send new board email');
    }

    // The welcome mail may have marked the board.
    await createdBoard.reload();

    return res.json({
        success: true,
        data: createdBoard
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

// A date (2021-01-10) or a full ISO 8601 timestamp with a time zone, such as an Agora's
// end (2021-01-10T16:00:00.000Z). A timestamp counts by the day it was written with.
const ENDS_FORMAT = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2}))?$/;
const parseEndsDay = (value) => {
    // The format check leaves out partial forms (2021, 20210110); the strict parse, values
    // that are no real date or time (2021-13-45, T25:00).
    if (typeof value !== 'string' || !ENDS_FORMAT.test(value) || !moment.parseZone(value, moment.ISO_8601, true).isValid()) {
        return null;
    }

    return moment(value.slice(0, 10), 'YYYY-MM-DD', true);
};

exports.listMostRecentBoardsElected = async (req, res) => {
    if (!req.permissions.view_board) {
        return errors.makeForbiddenError(res, 'You are not allowed to list recently elected boards.');
    }

    let endDate = moment().endOf('day').toDate();
    if (req.query.ends) {
        const ends = parseEndsDay(req.query.ends);
        if (!ends) {
            return res.status(422).json({ success: false, errors: { ends: ['The end date should be a date (YYYY-MM-DD) or an ISO 8601 timestamp.'] } });
        }

        endDate = ends.endOf('day').toDate();
    }

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

// Loads the board for the single-board routes. Viewers and the board managers of the
// body in the URL get this far, which is also who may see a single board; editing and
// deleting check their own permission.
exports.findBoard = async (req, res, next) => {
    const managesBody = req.permissions.manage_boards.global || req.permissions.manage_boards[req.params.body_id] === true;
    if (!req.permissions.view_board && !managesBody) {
        return errors.makeForbiddenError(res, 'You are not allowed to see this board.');
    }

    if (!helpers.isNumber(req.params.body_id)) {
        return errors.makeBadRequestError(res, 'Body ID is invalid.');
    }

    if (!helpers.isNumber(req.params.board_id)) {
        return errors.makeBadRequestError(res, 'Board ID is invalid.');
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
    return res.json({
        success: true,
        data: req.board
    });
};

exports.updateBoard = async (req, res) => {
    if (!req.permissions.manage_boards[req.board.body_id] && !req.permissions.manage_boards.global) {
        return errors.makeForbiddenError(res, 'You are not allowed to update boards.');
    }

    // The board as it would be stored is checked as a whole; then the members the edit
    // adds or changes are looked up in core, as on creation.
    const stored = req.board.get({ clone: true });
    req.board.set(pickBoardFields(req.body));
    await req.board.validate();

    const { fieldErrors } = await lookUpMembers(changedMembers(stored, req.board.get()), req.headers['x-auth-token']);
    if (Object.keys(fieldErrors).length > 0) {
        return res.status(422).json({ success: false, errors: fieldErrors });
    }

    await req.board.save();

    return res.json({
        success: true,
        data: req.board
    });
};

exports.deleteBoard = async (req, res) => {
    if (!req.permissions.manage_boards.global) {
        return errors.makeForbiddenError(res, 'Deleting a board needs the global:manage_network:boards permission.');
    }

    await req.board.destroy();

    return res.json({
        success: true,
        data: req.board
    });
};

// Sends the welcome mail to a board whose term has started and not ended,
// and marks the board so the mail is not sent again.
exports.sendNewBoardEmail = async (id) => {
    const board = await Board.findByPk(id);

    if (!board) {
        return;
    }

    if (moment(board.start_date).isAfter(moment(), 'day')) {
        return;
    }

    if (board.end_date && moment(board.end_date).isBefore(moment(), 'day')) {
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

    await board.update({ new_board_email_sent_at: new Date() });
};
