const { errors } = require('oms-common-nodejs');

const { Event, Application } = require('../models');
const constants = require('./constants');
const helpers = require('./helpers');

exports.listAllApplications = async (req, res) => {
    if (!req.permissions.see_applications) {
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
    if (!req.permissions.see_applications && req.application.user_id !== req.user.id) {
        return errors.makeForbiddenError(res, 'You are not allowed to see this application.');
    }

    return res.json({
        success: true,
        data: req.application
    });
};

exports.updateApplication = async (req, res) => {
    if (!req.permissions.edit_application) {
        return errors.makeForbiddenError(res, 'You cannot edit this application.')
    }

    if (req.body.answers != null && !helpers.isAnswersValid(req.event.questions, req.body.answers)) {
        return errors.makeValidationError(res, 'Some answers are invalid.');
    }

    if (req.application.user_id === req.user.id && req.body.body_id && !helpers.isMemberOf(req.user, req.body.body_id)) {
        return errors.makeForbiddenError(res, 'You cannot apply on behalf of the body you are not a member of.');
    }

    delete req.body.status;
    delete req.body.board_comment;
    delete req.body.participant_type;
    delete req.body.attended;
    delete req.body.cancelled;
    delete req.body.paid_fee;

    // If user changed his body (by himself), reset his board comment and participant type.
    if (req.application.user_id === req.user.id && req.body.body_id && req.body.body_id !== req.application.body_id) {
        req.body.participant_type = null;
        req.body.board_comment = null;
    }

    const dbResult = await Application.update(req.body, { where: { id: req.application.id }, returning: true });

    return res.json({
        success: true,
        data: dbResult[1][0]
    });
};

function setApplicationBoolean (key) {
    return async (req, res) => {
        // Only 'cancelled' can work with '/me' postfix.
        if (key !== 'cancelled' && req.params.application_id === constants.CURRENT_USER_PREFIX) {
            return errors.makeForbiddenError(res, `You cannot change the "${key}" attribute through this endpoint.`);
        }

        // Either the current user or this user who has permission to see it is allowed.
        if (!req.permissions['set_application_' + key]) {
            return errors.makeForbiddenError(
                res,
                `You don't have permissions to change the "${key}" attribute of this application.`
            );
        }

        const toUpdate = {};
        toUpdate[key] = req.body[key];

        const dbResult = await Application.update(toUpdate, { where: { id: req.application.id }, returning: true });

        return res.json({
            success: true,
            data: dbResult[1][0]
        });
    };
}

exports.setApplicationCancelled = setApplicationBoolean('cancelled');
exports.setApplicationAttended = setApplicationBoolean('attended');
exports.setApplicationPaidFee = setApplicationBoolean('paid_fee');

exports.setApplicationStatus = async (req, res) => {
    // ID is either 'me' or an integer (user ID)
    if (Number.isNaN(Number(req.params.application_id, 10))) {
        return errors.makeForbiddenError(res, 'You cannot edit status of yourself.');
    }

    // Either the current user or this user who has permission to see it is allowed.
    if (!req.permissions.change_status) {
        return errors.makeForbiddenError(
            res,
            'You don\'t have permissions to change the "status" attribute of this application.'
        );
    }

    const dbResult = await Application.update(
        { status: req.body.status },
        { where: { id: req.application.id }, returning: true }
    );

    return res.json({
        success: true,
        data: dbResult[1][0]
    });
};

exports.postApplication = async (req, res) => {
    if (!req.permissions.apply) {
        return errors.makeForbiddenError(res, 'The deadline for applications has passed or the applications period hasn\'t started yet.')
    }

    req.body.user_id = req.user.id
    const application = req.event.applications.find(application => application.user_id === req.body.user_id);

    if (application) {
        return errors.makeBadRequestError(res, `There's already application with this ID in the system. \
If it\'s yours, please update it via PUT /events/:event_id/applications/${constants.CURRENT_USER_PREFIX}.`)
    }

    if (!helpers.isAnswersValid(req.event.questions, req.body.answers)) {
        return errors.makeValidationError(res, 'Some answers are invalid.');
    }

    if (!helpers.isMemberOf(req.user, req.body.body_id)) {
        return errors.makeForbiddenError(res, 'You cannot apply on behalf of the body you are not a member of.');
    }

    delete req.body.status;
    delete req.body.board_comment;
    delete req.body.participant_type;
    delete req.body.attended;
    delete req.body.cancelled;
    delete req.body.paid_fee;

    req.body.event_id = req.event.id;

    const newApplication = await Application.create(req.body);

    return res.json({
        success: true,
        data: newApplication
    });
};
