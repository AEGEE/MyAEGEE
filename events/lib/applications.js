const { errors } = require('oms-common-nodejs');

const { Event } = require('../models');

exports.listUserAppliedEvents = async (req, res, next) => {
  const events = await Event
    .where('ends').gte(new Date()) // Only show events in the future
    .elemMatch('applications', { user_id: req.user.id })
    .select(['name', 'starts', 'ends', 'description', 'type', 'status', 'max_participants', 'application_status', 'organizing_locals'].join(' '));

  return res.json({
    success: true,
    data: events,
  });
};

/** Participants **/
exports.listParticipants = async (req, res, next) => {
  const event = req.event;
  let status = req.params.status;
  let applications = event.applications.toObject();

  // Only authorized persons can see all applications
  // Others will only see accepted ones and will not see their application text
  if (!req.user.permissions.can.view_applications) {
    status = 'accepted';
  }

  // Filtering applications
  if (status) {
    applications = applications.filter(application => application.status === status);
  }

  for (const application of applications) {
    application.url = `${event.url}/participants/${applications.id}`;
    if (!req.user.permissions.can.approve_participants) {
      delete application.board_comment;
      delete application.application;
    }
  }

  return res.json({
    success: true,
    data: applications,
  });
};

exports.getApplication = async (req, res, next) => {
  if (!req.permissions.view_application) {
    return errors.makeForbiddenError(res, 'You cannot apply to this event or change your application');
  }

  return res.json({
    success: true,
    data: application,
  });
};

exports.setApplication = async (req, res, next) => {
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

exports.setApplicationStatus = async (req, res, next) => {
  // Check user permissions
  if (!req.permissions.approve_participants) {
    return errors.makeForbiddenError(res, 'You are not allowed to accept or reject participants');
  }

  await req.application.update({ status: req.body.status });

  return res.json({
    success: true,
    data: application
  });
};

exports.setApplicationComment = async (req, res, next) => {
  // Check user permissions
  if (!req.permissions.set_board_comment[application.body_id]) {
    return errors.makeForbiddenError(res, 'You are not allowed to put board comments');
  }

  // Save changes
  await req.application.update({ board_comment: req.body.board_comment });

  return res.json({
    success: true,
    data: application
  });
};
