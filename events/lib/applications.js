const restify = require('restify');

const log = require('./config/logger.js');
const helpers = require('./helpers.js');
const Event = require('./models/Event');

exports.listUserAppliedEvents = (req, res, next) => {
  Event
    // TODO: Fix this stuff.
    // Either delete this line, or change it to load the 'deleted' field.
    // See the 'deleteEvent' endpoint comment.
    // .where('status').ne('deleted') // Hide deleted events
    .where('ends').gte(new Date()) // Only show events in the future
    .elemMatch('applications', { foreign_id: req.user.basic.id })
    .select(['name', 'starts', 'ends', 'description', 'type', 'status', 'max_participants', 'application_status', 'organizing_locals'].join(' '))
    .exec((err, events) => {
      if (err) {
        log.info(err);
        return next(new restify.InternalError());
      }

      res.json({
        success: true,
        data: events,
      });
      return next();
    });
};

/** Participants **/
exports.listParticipants = (req, res, next) => {
  const event = req.event;
  let status = req.params.status;
  const applications = event.applications.toObject();

  // Only authorized persons can see all applications
  // Others will only see accepted ones and will not see their application text
  if (!req.user.permissions.can.view_applications) {
    status = 'accepted';
  }

  for (let i = applications.length - 1; i >= 0; i--) {
    applications[i].url = `${event.url}/participants/${applications[i].foreign_id}`;
    if (!req.user.permissions.can.approve_participants) {
      delete applications[i].board_comment;
      delete applications[i].application;
    }

    if (status && applications[i].application_status !== status) {
      applications.splice(i, 1);
    }
  }

  res.json({
    success: true,
    data: applications,
  });
  return next();
};

exports.getApplication = (req, res, next) => {
  const event = req.event;

  // Search for the application
  const application = event.applications.find(element => element.foreign_id === req.user.basic.id);

  if (application === undefined) {
    return next(new restify.ResourceNotFoundError({
      body: {
        success: false,
        message: `User ${req.user.basic.id} not found`,
      },
    }));
  }

  res.json({
    success: true,
    data: [application],
  });
  return next();
};

exports.setApplication = (req, res, next) => {
  const event = req.event;

  // Check for permission
  if (!req.user.permissions.can.apply) {
    return next(new restify.ForbiddenError({
      body: {
        success: false,
        message: 'You cannot apply to this event',
      },
    }));
  }

  // Find the corresponding application
  let index;
  const application = event.applications.find((element, idx) => {
    if (element.foreign_id === req.user.basic.id) {
      index = idx;
      return true;
    }

    return false;
  });

  // If user hasn't applied yet, create an application
  if (application === undefined) {
    event.applications.push({
      foreign_id: req.user.basic.id,
      first_name: req.user.basic.first_name,
      last_name: req.user.basic.last_name,
      antenna: req.user.basic.antenna_name,
      antenna_id: req.user.basic.antenna_id,
      application: req.body.application,
    });
    index = event.applications.length - 1;
  } else {
    event.applications[index].application = req.body.application;
  }


  // Only check the current application for validity,
  // as checking all of them would be too much overhead on big events
  const tmp = helpers.checkApplicationValidity(
    event.applications[index].application, event.application_fields);
  if (!tmp.passed) {
    return next(new restify.InvalidContentError({
      body: {
        success: false,
        message: `Application malformed: ${tmp.msg}`,
      },
    }));
  }

  return event.save((err) => {
    if (err) {
      // Send validation-errors back to client
      if (err.name === 'ValidationError') {
        return next(new restify.InvalidArgumentError({
          body: {
            success: false,
            errors: err.errors,
            message: err.message,
          },
        }));
      }

      log.error('Could not save application', err);
      return next(new restify.InternalError({
        body: {
          success: false,
          message: err.message,
        },
      }));
    }

    res.json({
      success: true,
      message: 'Application saved',
      application: event.applications[index],
    });
    return next();
  });
};

exports.setApplicationStatus = (req, res, next) => {
  // Check user permissions
  if (!req.user.permissions.can.approve_participants) {
    return next(new restify.ForbiddenError({
      body: {
        success: false,
        message: 'You are not allowed to accept or reject participants',
      },
    }));
  }

  const event = req.event;

  // Find the corresponding application
  let index;
  const application = event.applications.find((element, idx) => {
    if (element.id === req.params.application_id) {
      index = idx;
      return true;
    }

    return false;
  });

  if (application === undefined) {
    return next(new restify.NotFoundError({
      body: {
        success: false,
        message: `Could not find application id ${req.params.application_id}`,
      },
    }));
  }

  // Save changes
  event.applications[index].application_status = req.body.application_status;

  return event.save((err) => {
    if (err) {
      // Send validation-errors back to client
      if (err.name === 'ValidationError') {
        return next(new restify.InvalidArgumentError({
          body: {
            success: false,
            errors: err.errors,
            message: err.message,
          },
        }));
      }

      log.error('Could not set application status', err);
      return next(new restify.InternalError({
        body: {
          success: false,
          message: err.message,
        },
      }));
    }

    res.json({
      success: true,
      message: 'Application successfully updated',
    });
    return next();
  });
};

exports.setApplicationComment = (req, res, next) => {
  // Check user permissions
  if (!req.user.permissions.can.view_local_involved_events) {
    return next(new restify.ForbiddenError({
      body: {
        success: false,
        message: 'You are not allowed to put board comments',
      },
    }));
  }

  const event = req.event;

  // Find the corresponding application
  let index;
  const application = event.applications.find((element, idx) => {
    if (element.id === req.params.application_id) {
      index = idx;
      return true;
    }

    return false;
  });

  if (application === undefined) {
    return next(new restify.NotFoundError({
      body: {
        success: false,
        message: `Could not find application id ${req.params.application_id}`,
      },
    }));
  }

  // Save changes
  event.applications[index].board_comment = req.body.board_comment;

  return event.save((err) => {
    if (err) {
      // Send validation-errors back to client
      if (err.name === 'ValidationError') {
        return next(new restify.InvalidArgumentError({
          body: {
            success: false,
            errors: err.errors,
            message: err.message,
          },
        }));
      }

      log.error('Could not set board comment', err);
      return next(new restify.InternalError({
        body: {
          success: false,
          message: err.message,
        },
      }));
    }

    res.json({
      success: true,
      message: 'Board comment stored',
    });
    return next();
  });
};
