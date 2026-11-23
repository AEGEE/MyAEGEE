const errors = require('./errors');
const { Question, Application } = require('../models');
const constants = require('./constants');
const helpers = require('./helpers');

exports.findQuestion = async (req, res, next) => {
    if (Number.isNaN(Number(req.params.question_id))) {
        return errors.makeBadRequestError(res, 'The question ID is invalid.');
    }

    // Only a question of the question line in the URL.
    const question = await Question.findOne({
        where: { id: Number(req.params.question_id), question_line_id: req.questionLine.id },
        include: [{
            model: Application,
            attributes: constants.ALLOWED_QUESTION_LINE_APPLICATION_FIELDS
        }]
    });
    if (!question) {
        return errors.makeNotFoundError(res, 'Question is not found.');
    }

    req.permissions.edit_question = question.application.user_id === req.user.id
        || req.permissions.manage_question_lines;

    req.question = question;
    return next();
};

exports.submitQuestion = async (req, res) => {
    if (!req.permissions.submit_questions) {
        return errors.makeForbiddenError(res, 'You cannot submit a question.');
    }

    if (req.questionLine.status !== 'open') {
        return errors.makeForbiddenError(res, 'The question line is closed, you cannot ask questions now.');
    }

    // Only the text is saved, anything else in the request is ignored.
    req.body = helpers.whitelistObject(req.body, constants.QUESTION_FORM_FIELDS);

    req.body.application_id = req.myApplication.id;
    req.body.question_line_id = req.questionLine.id;

    const newQuestion = await Question.create(req.body);

    return res.json({
        success: true,
        data: newQuestion
    });
};

exports.getQuestion = async (req, res) => {
    // The member who asked the question can always read it, as they can edit and delete it.
    if (!req.permissions.see_questions && req.question.application.user_id !== req.user.id) {
        return errors.makeForbiddenError(res, 'You cannot see this question.');
    }

    return res.json({
        success: true,
        data: req.question
    });
};

exports.editQuestion = async (req, res) => {
    if (!req.permissions.edit_question) {
        return errors.makeForbiddenError(res, 'You cannot edit this question.');
    }

    // Once the question line is closed, only those who manage question lines can edit its questions.
    if (req.questionLine.status !== 'open' && !req.permissions.manage_question_lines) {
        return errors.makeForbiddenError(res, 'The question line is closed, you cannot edit questions now.');
    }

    // Only the text is saved, anything else in the request is ignored.
    req.body = helpers.whitelistObject(req.body, constants.QUESTION_FORM_FIELDS);

    // returning: the answer has the values as they were stored, not as they were sent.
    await req.question.update(req.body, { returning: true });

    return res.json({
        success: true,
        data: req.question
    });
};

exports.deleteQuestion = async (req, res) => {
    if (!req.permissions.edit_question) {
        return errors.makeForbiddenError(res, 'You cannot delete this question.');
    }

    // Once the question line is closed, only those who manage question lines can delete its questions.
    if (req.questionLine.status !== 'open' && !req.permissions.manage_question_lines) {
        return errors.makeForbiddenError(res, 'The question line is closed, you cannot delete questions now.');
    }

    await req.question.destroy();

    return res.json({
        success: true,
        message: 'Question is deleted.'
    });
};
