const helpers = require('./helpers.js');
const Event = require('./models/Event');

exports.listUserAppliedEvents = async (req, res, next) => {
  const events = await Event
    .where('ends').gte(new Date()) // Only show events in the future
    .elemMatch('applications', { user_id: req.user.id })
    .select(['name', 'starts', 'ends', 'description', 'type', 'status', 'max_participants', 'application_status', 'organizing_locals'].join(' '))
    .toArray();

  res.json({
    success: true,
    data: events,
  });

  return next();
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

  res.json({
    success: true,
    data: applications,
  });
  return next();
};

exports.getApplication = async (req, res, next) => {
  const event = req.event;

  // Search for the application
  const application = event.applications.find(app => app.user_id === req.user.id);

  if (!application) {
    return helpers.makeNotFoundError(res, `Application for user ${req.user.id} not found`);
  }

  res.json({
    success: true,
    data: application,
  });
  return next();
};

exports.setApplication = async (req, res, next) => {
  const event = req.event;

  // Check for permission
  if (!req.user.permissions.can.apply) {
    return helpers.makeForbiddenError(res, 'You cannot apply to this event');
  }

  // Find the corresponding application
  const application = event.applications.find(app => app.user_id === req.user.id);

  // If user hasn't applied yet, create an application
  if (!application) {
    event.applications.push({
      id: req.user.id,
      body_id: req.user.body_id,
      application: req.body.application,
    });
  } else {
    application.application = req.body.application;
  }

  await event.save();

  res.json({
    success: true,
    message: 'Application saved',
    data: application,
  });
  return next();
};

exports.setApplicationStatus = async (req, res, next) => {
  // Check user permissions
  if (!req.user.permissions.can.approve_participants) {
    return helpers.makeForbiddenError(res, 'You are not allowed to accept or reject participants');
  }

  const event = req.event;

  // Find the corresponding application
  const application = event.applications.find(element => element.id === req.params.user_id);

  if (!application) {
    return helpers.makeNotFoundError(res, `Could not find application id ${req.params.user}`);
  }

  // Save changes
  application.status = req.body.status;

  await event.save();

  res.json({
    success: true,
    message: 'Application successfully updated',
  });
  return next();
};

exports.setApplicationComment = async (req, res, next) => {
  // Check user permissions
  if (!req.user.permissions.can.view_local_involved_events) {
    return helpers.makeForbiddenError(res, 'You are not allowed to put board comments');
  }

  const event = req.event;

  // Find the corresponding application
  const application = event.applications.find(element => element.user_id === req.params.user_id);

  if (!application) {
    return helpers.makeNotFoundError(res, `Could not find application id ${req.params.user_id}`);
  }

  // Save changes
  application.board_comment = req.body.board_comment;

  await event.save();

  res.json({
    success: true,
    message: 'Board comment stored',
  });
  return next();
};
