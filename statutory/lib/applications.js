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
    // ID is either 'me' or an integer (user ID)
    if (!helpers.isIDValid(req.params.id)) {
        return errors.makeBadRequestError(res, `User ID should be either a number or '${constants.CURRENT_USER_PREFIX}'`);
    }

    const idToSearchBy = req.params.id === constants.CURRENT_USER_PREFIX ? req.user.id : parseInt(req.params.id, 10);
    const userPrefix = req.params.id === constants.CURRENT_USER_PREFIX ? 'You' : 'This user';

    // Either the current user or this user who has permission to see it is allowed.
    if (req.params.id !== constants.CURRENT_USER_PREFIX && !req.permissions.see_applications) {
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
    if (!helpers.isIDValid(req.params.id)) {
        return errors.makeBadRequestError(res, `User ID should be either a number or '${constants.CURRENT_USER_PREFIX}'`);
    }

    req.permissions = helpers.getApplicationPermissions({
        permissions: req.permissions,
        corePermissions: req.corePermissions,
        user: req.user,
        event: req.event,
        mine: req.params.id === constants.CURRENT_USER_PREFIX
    });

    if (!req.permissions.edit_application) {
        return errors.makeForbiddenError(res, 'The deadline for applications has passed.')
    }

    const idToSearchBy = req.params.id === constants.CURRENT_USER_PREFIX ? req.user.id : parseInt(req.params.id, 10);
    const userPrefix = req.params.id === constants.CURRENT_USER_PREFIX ? 'You' : 'This user';
    const application = req.event.applications.find(application => application.user_id === idToSearchBy);

    if (!application) {
        return errors.makeNotFoundError(res, userPrefix + ' haven\'t applied to this event yet.')
    }

    if (req.body.answers != null && !helpers.isAnswersValid(req.event.questions, req.body.answers)) {
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

function setApplicationBoolean (key) {
    return async (req, res) => {
        // ID is either 'me' or an integer (user ID)
        if (!helpers.isIDValid(req.params.id)) {
            return errors.makeBadRequestError(res, `User ID should be either a number or '${constants.CURRENT_USER_PREFIX}'`);
        }

        // Only 'cancelled' can work with 'me' prefix.
        if (key !== 'cancelled' && req.params.id === constants.CURRENT_USER_PREFIX) {
            return errors.makeForbiddenError(res, `You cannot change the "${key}" attribute through this endpoint.`);
        }

        req.permissions = helpers.getApplicationPermissions({
            permissions: req.permissions,
            corePermissions: req.corePermissions,
            user: req.user,
            event: req.event,
            mine: req.params.id === constants.CURRENT_USER_PREFIX
        });

        const idToSearchBy = req.params.id === constants.CURRENT_USER_PREFIX ? req.user.id : parseInt(req.params.id, 10);
        const userPrefix = req.params.id === constants.CURRENT_USER_PREFIX ? 'You' : 'This user';

        // Either the current user or this user who has permission to see it is allowed.
        if (!req.permissions['set_application_' + key]) {
            return errors.makeForbiddenError(
                res,
                `You don't have permissions to change the "${key}" attribute of this application.`
            );
        }

        const application = req.event.applications.find(application => application.user_id === idToSearchBy);

        if (!application) {
            return errors.makeNotFoundError(res, userPrefix + ' haven\'t applied to this event yet.')
        }

        const toUpdate = {};
        toUpdate[key] = req.body[key];

        const dbResult = await Application.update(toUpdate, { where: { id: application.id }, returning: true });

        return res.json({
            success: true,
            data: dbResult[1][0]
        });
    };
}

exports.setApplicationCancelled = setApplicationBoolean('cancelled');
exports.setApplicationAttended = setApplicationBoolean('attended');
exports.setApplicationPaidFee = setApplicationBoolean('paid_fee');

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
