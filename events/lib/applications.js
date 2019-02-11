const errors = require('./errors');
const { Event, Application } = require('../models');
const helpers = require('./helpers');

exports.listUserAppliedEvents = async (req, res) => {
    const applications = await Application.findAll({ where: { user_id: req.user.id }, include: [Event] });
    const events = applications.map(a => a.event);

    return res.json({
        success: true,
        data: events,
    });
};

exports.listAllApplications = async (req, res) => {
    if (!req.permissions.list_applications) {
        return errors.makeForbiddenError(res, 'You cannot see applications for this event.');
    }

    const applications = await Application.findAll({ where: { event_id: req.event.id } });

    return res.json({
        success: true,
        data: applications,
    });
};

exports.getApplication = async (req, res) => {
    const application = await Application.findOne({ where: { event_id: req.event.id, user_id: req.user.id } });
    if (!application) {
        return errors.makeNotFoundError(res, 'Application is not found.');
    }

    return res.json({
        success: true,
        data: application,
    });
};

exports.setApplication = async (req, res) => {
  // Check for permission
    if (!req.permissions.apply) {
        return errors.makeForbiddenError(res, 'You cannot apply to this event or change your application');
    }

    if (typeof req.body.body_id !== 'undefined' && !helpers.isMemberOf(req.user, req.body.body_id)) {
        return errors.makeBadRequestError(res, 'You are not a member of this body.');
    }

    delete req.body.board_comment;
    delete req.body.status;


    let application = await Application.findOne({ where: { event_id: req.event.id, user_id: req.user.id } });
    if (application) {
        await application.update(req.body);
    } else {
        req.body.first_name = req.user.first_name;
        req.body.last_name = req.user.last_name;
        req.body.body_name = req.user.bodies.find(b => b.id === req.body.body_id).name;
        req.body.user_id = req.user.id;
        req.body.event_id = req.event.id;

        application = await Application.create(req.body);
    }


    return res.json({
        success: true,
        message: 'Application saved',
        data: application,
    });
};

exports.setApplicationStatus = async (req, res) => {
  // Check user permissions
    if (!req.permissions.approve_participants) {
        return errors.makeForbiddenError(res, 'You are not allowed to accept or reject participants');
    }

    await req.application.update({ status: req.body.status });

    return res.json({
        success: true,
        data: req.application
    });
};

exports.setApplicationComment = async (req, res) => {
  // Check user permissions
    if (!req.permissions.set_board_comment[req.application.body_id]) {
        return errors.makeForbiddenError(res, 'You are not allowed to put board comments');
    }

  // Save changes
    await req.application.update({ board_comment: req.body.board_comment });

    return res.json({
        success: true,
        data: req.application
    });
};
