const { errors } = require('oms-common-nodejs');

const { Event, Application } = require('../models');
const constants = require('./constants');

exports.listAllApplications = async (req, res) => {
    if (!req.user.permissions.can.see_applications[req.event.type]) {
        return errors.makeForbiddenError(res, 'You are not allowed to create events of this type.');
    }

    return res.json({
        success: true,
        data: req.event.applications
    });
};

exports.listAcceptedApplications = async (req, res) => {
    const applications = req.event.applications
        .filter(application => application.status === 'accepted')
        .map(application => application.toJSON())
        .map(application => {
            delete application.answers;
            delete application.board_comment;
            delete application.visa_required;
            delete application.status;

            return application;
        });

    return res.json({
        success: true,
        data: applications
    });
};

exports.getApplication = async (req, res) => {
    // ID is either 'me' or an integer (user ID)
    if (req.params.id !== constants.CURRENT_USER_PREFIX && Number.isNaN(Number(req.params.id, 10))) {
        return errors.makeBadRequestError(res, `User ID should be either a number or '${constants.CURRENT_USER_PREFIX}'`);
    }

    const idToSearchBy = req.params.id === constants.CURRENT_USER_PREFIX ? req.user.id : parseInt(req.params.id, 10);
    const userPrefix = req.params.id === constants.CURRENT_USER_PREFIX ? 'You' : 'This user';

    // Either the current user or this user who has permission to see it is allowed.
    if (req.params.id !== constants.CURRENT_USER_PREFIX && !req.user.permissions.can.see_applications[req.event.type]) {
        return errors.makeForbiddenError(res, 'You don\'t have permissions to access this application.')
    }

    const application = req.event.applications.find(application => application.user_id === idToSearchBy);

    if (!application) {
        return errors.makeNotFoundError(res, userPrefix + ' haven\'t applied to this event yet.')
    }

    return res.json({
        success: true,
        data: application
    });
};

exports.updateApplication = async (req, res) => {
    // ID is either 'me' or an integer (user ID)
    if (req.params.id !== constants.CURRENT_USER_PREFIX && Number.isNaN(Number(req.params.id, 10))) {
        return errors.makeBadRequestError(res, `User ID should be either a number or '${constants.CURRENT_USER_PREFIX}'`);
    }

    if (!req.event.can_apply) {
        return errors.makeForbiddenError(res, 'The deadline for applications has passed.')
    }

    const idToSearchBy = req.params.id === constants.CURRENT_USER_PREFIX ? req.user.id : parseInt(req.params.id, 10);
    const userPrefix = req.params.id === constants.CURRENT_USER_PREFIX ? 'You' : 'This user';

    // Either the current user or this user who has permission to see it is allowed.
    if (req.params.id !== constants.CURRENT_USER_PREFIX && !req.user.permissions.can.edit_applications[req.event.type]) {
        return errors.makeForbiddenError(res, 'You don\'t have permissions to edit this application.')
    }

    const application = req.event.applications.find(application => application.user_id === idToSearchBy);

    if (!application) {
        return errors.makeNotFoundError(res, userPrefix + ' haven\'t applied to this event yet.')
    }

    if (req.body.answers != null && (!Array.isArray(req.body.answers) || req.body.answers.length !== req.event.questions.length)) {
        return errors.makeValidationError(res, 'Some answers are invalid.');
    }

    delete req.body.status;
    delete req.body.board_comment;
    delete req.body.participant_type;
    delete req.body.attended;
    delete req.body.cancelled;
    delete req.body.paid_fee;

    const dbResult = await Application.update(req.body, { where: { id: application.id }, returning: true });

    return res.json({
        success: true,
        data: dbResult[1][0]
    });
};

exports.postApplication = async (req, res) => {
    if (!req.event.can_apply) {
        return errors.makeForbiddenError(res, 'The deadline for applications has passed or the applications period hasn\'t started yet.')
    }

    const userId = req.body.user_id ? req.body.user_id : req.user.id;

    // Either the current user or this user who has permission to see it is allowed.
    if (req.body.user_id != null
        && req.body.user_id !== req.user.id
        && !req.user.permissions.can.create_applications[req.event.type]) {
        return errors.makeForbiddenError(res, 'You don\'t have permissions to apply.')
    }

    const application = req.event.applications.find(application => application.user_id === userId);

    if (application) {
        return errors.makeBadRequestError(res, `There's already application with this ID in the system. \
If it\'s yours, please update it via PUT /events/:event_id/applications/${constants.CURRENT_USER_PREFIX}.`)
    }

    if (!Array.isArray(req.body.answers) || req.body.answers.length !== req.event.questions.length) {
        return errors.makeValidationError(res, 'Some answers are invalid.');
    }

    delete req.body.status;
    delete req.body.board_comment;
    delete req.body.participant_type;
    delete req.body.attended;
    delete req.body.cancelled;
    delete req.body.paid_fee;

    req.body.user_id = userId;
    req.body.event_id = req.event.id;

    const newApplication = await Application.create(req.body);

    return res.json({
        success: true,
        data: newApplication
    });
};
