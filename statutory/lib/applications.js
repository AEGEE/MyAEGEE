const { errors } = require('oms-common-nodejs');

const { Event, Application } = require('../models');

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