const errors = require('./errors');
const { Question, Application } = require('../models');
const constants = require('./constants');

exports.findQuestion = async (req, res, next) => {
    if (Number.isNaN(Number(req.params.question_id))) {
        return errors.makeBadRequestError(res, 'The question ID is invalid.');
    }

    const question = await Question.findOne({
        where: { id: Number(req.params.question_id) },
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

    delete req.body.status;

    req.body.application_id = req.myApplication.id;
    req.body.question_line_id = req.questionLine.id;

    const newQuestion = await Question.create(req.body);

    return res.json({
        success: true,
        data: newQuestion
    });
};

exports.getQuestion = async (req, res) => {
    if (!req.permissions.see_questions) {
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

    if (req.questionLine.status !== 'open') {
        return errors.makeForbiddenError(res, 'The question line is closed, you cannot edit questions now.');
    }

    delete req.body.status;
    delete req.body.application_id;
    delete req.body.question_line_id;

    await req.question.update(req.body);

    return res.json({
        success: true,
        data: req.question
    });
};

exports.deleteQuestion = async (req, res) => {
    if (!req.permissions.edit_question) {
        return errors.makeForbiddenError(res, 'You cannot delete this question.');
    }

    await req.question.destroy();

    return res.json({
        success: true,
        data: 'Question is deleted.'
    });
};
