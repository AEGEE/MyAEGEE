const helpers = require('./helpers');
const Event = require('./models/Event');

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
  const event = req.event;

  // Search for the application
  const application = event.applications.find(app => app.user_id === req.user.id);

  if (!application) {
    return helpers.makeNotFoundError(res, `Application for user ${req.user.id} not found`);
  }

  return res.json({
    success: true,
    data: application,
  });
};

exports.setApplication = async (req, res, next) => {
  const event = req.event;

  // Check for permission
  if (!req.user.permissions.can.apply) {
    return helpers.makeForbiddenError(res, 'You cannot apply to this event or change your application');
  }

  // Find the corresponding application
  const application = event.applications.find(app => app.user_id === req.user.id);

  // If user hasn't applied yet, create an application
  if (!application && !req.user.permissions.is.member_of[req.body.body_id]) {
    return helpers.makeBadRequestError(res, 'You are not a member of this body.');
  } else if (!application) {
    event.applications.push({
      user_id: req.user.id,
      body_id: req.body.body_id,
      application: req.body.application,
    });
  } else if (application.status !== 'requesting') {
    // TODO: move this to validation when .isModified() for arrays of subdocuments
    // would be fixed in Mongoose.
    // more details here: https://github.com/Automattic/mongoose/issues/4224
    // and here: https://github.com/Automattic/mongoose/issues/4487
    return helpers.makeForbiddenError(res, 'You cannot change this application anymore.');
  } else {
    application.application = req.body.application;
  }

  await event.save();

  return res.json({
    success: true,
    message: 'Application saved',
    data: application,
  });
};

exports.setApplicationStatus = async (req, res, next) => {
  // Check user permissions
  if (!req.user.permissions.can.approve_participants) {
    return helpers.makeForbiddenError(res, 'You are not allowed to accept or reject participants');
  }

  const event = req.event;

  // Find the corresponding application
  const index = event.applications.findIndex(app => app.id === req.params.application_id);

  if (index === -1) {
    return helpers.makeNotFoundError(res, `Could not find application id ${req.params.application_id}`);
  }

  // Save changes
  event.applications[index].status = req.body.status;

  await event.save();

  return res.json({
    success: true,
    message: 'Application successfully updated',
  });
};

exports.setApplicationComment = async (req, res, next) => {
  const event = req.event;

  // Find the corresponding application
  const application = event.applications.find(element => element.id === req.params.application_id);

  if (!application) {
    return helpers.makeNotFoundError(res, `Could not find application id ${req.params.application_id}`);
  }

  // Check user permissions
  if (!req.user.permissions.can.put_board_comment_for_application[application.id]) {
    return helpers.makeForbiddenError(res, 'You are not allowed to put board comments');
  }

  // Save changes
  application.board_comment = req.body.board_comment;

  await event.save();

  return res.json({
    success: true,
    message: 'Board comment stored',
  });
};
