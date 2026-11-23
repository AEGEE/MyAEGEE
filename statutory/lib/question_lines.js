const errors = require('./errors');
const { QuestionLine, Question, Application } = require('../models');
const helpers = require('./helpers');
const constants = require('./constants');

exports.findQuestionLine = async (req, res, next) => {
    if (Number.isNaN(Number(req.params.question_line_id))) {
        return errors.makeBadRequestError(res, 'The question line ID is invalid.');
    }

    // Only a question line of the event in the URL.
    const questionLine = await QuestionLine.findOne({
        where: { id: Number(req.params.question_line_id), event_id: req.event.id }
    });
    if (!questionLine) {
        return errors.makeNotFoundError(res, 'Question line is not found.');
    }

    req.questionLine = questionLine;
    return next();
};

exports.listAllQuestionLines = async (req, res) => {
    if (!req.permissions.see_questions && !req.permissions.manage_question_lines) {
        return errors.makeForbiddenError(res, 'You are not allowed to see questions');
    }

    const questionLines = await QuestionLine.findAll({
        where: { event_id: req.event.id },
        order: [
            ['created_at', 'ASC'],
            [Question, 'created_at', 'ASC']
        ],
        include: [{
            model: Question,
            include: [{
                model: Application,
                attributes: constants.ALLOWED_QUESTION_LINE_APPLICATION_FIELDS
            }]
        }]
    });

    return res.json({
        success: true,
        data: questionLines
    });
};

exports.createQuestionLine = async (req, res) => {
    if (!req.permissions.manage_question_lines) {
        return errors.makeForbiddenError(res, 'You cannot manage question lines.');
    }

    // Only the name is saved, anything else in the request is ignored.
    req.body = helpers.whitelistObject(req.body, constants.QUESTION_LINE_FORM_FIELDS);
    req.body.event_id = req.event.id;

    const newQuestionLine = await QuestionLine.create(req.body);

    return res.json({
        success: true,
        data: newQuestionLine
    });
};

exports.editQuestionLine = async (req, res) => {
    if (!req.permissions.manage_question_lines) {
        return errors.makeForbiddenError(res, 'You cannot manage question lines.');
    }

    // Only the name is saved, anything else in the request is ignored.
    req.body = helpers.whitelistObject(req.body, constants.QUESTION_LINE_FORM_FIELDS);

    await req.questionLine.update(req.body);

    return res.json({
        success: true,
        data: req.questionLine
    });
};

exports.updateQuestionLineStatus = async (req, res) => {
    if (!req.permissions.manage_question_lines) {
        return errors.makeForbiddenError(res, 'You cannot manage question lines.');
    }

    if (helpers.isDefined(req.body.status)) {
        await req.questionLine.update({ status: req.body.status });
    }

    return res.json({
        success: true,
        data: req.questionLine
    });
};

exports.deleteQuestionLine = async (req, res) => {
    if (!req.permissions.manage_question_lines) {
        return errors.makeForbiddenError(res, 'You cannot delete question lines.');
    }

    await Question.destroy({ where: { question_line_id: req.questionLine.id } });
    await req.questionLine.destroy();

    return res.json({
        success: true,
        message: 'The question line was deleted.'
    });
};
