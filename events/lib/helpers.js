const log = require('./config/logger');

function getBasicPermissions(user) {
  const permissions = {
    is: {},
    can: {},
    special: []
  };

  permissions.is.superadmin = user.is_superadmin;
  if (permissions.is.superadmin) {
    permissions.special.push('Superadmin');
  }

  permissions.can.edit_lifecycles = permissions.is.superadmin;
  permissions.can.delete_lifecycles = permissions.is.superadmin;

  return permissions;
}

function getEventIs(event, user) {
  const is = {};
  is.organizer = event.organizers.some(item => item.user_id === user.id);
  is.own_body = event.organizing_locals.some(organizer => user.bodies.some(body => organizer.body_id === body.id));

  return is;
}

function getEventSpecial(event, user, is) {
  const special = [];
  if (is.own_body) {
    special.push('Organizing Local Member');
  }
  if (is.organizer) {
    special.push('Organizer');
  }

  // Also all eventroles become special roles
  const myorg = event.organizers.find(item => item.user_id === user.id);
  if (myorg && myorg.roles && myorg.roles.length > 0) {
    myorg.roles.forEach((item) => {
      special.push(item.name);
    });
  }

  return special;
}

// Helper function for determining if two arrays are intersecting or not.
const intersects = (array1, array2) => array1.filter(elt => array2.includes(elt)).length > 0;

// Helper function for determining if the user has the right to do something
// TODO: Add circle awareness.

const canUserAccess = (options) => {
  const { user, accessObject, event } = options;

  // Checking users.
  if (accessObject.users && accessObject.users.includes(user.id)) {
    return true;
  }

  // Checking bodies.
  if (accessObject.bodies && intersects(accessObject.bodies, user.bodies.map(body => body.id))) {
    return true;
  }

  // Checking event-related special roles.
  if (event) {
    const permissionIs = getEventIs(event, user);
    const permissionSpecial = getEventSpecial(event, user, permissionIs);
    if (intersects(permissionSpecial, accessObject.special)) {
      return true;
    }
  }

  if (accessObject.special && intersects(accessObject.special, user.special)) {
    return true;
  }

  return false;
};

function getEventPermissions(event, user) {
  const permissions = {
    is: {},
    can: {},
    special: [],
  };

  if (!event || !user) {
    log.warn('No event or user is provided, returning empty object as a response.');
    return permissions;
  }

  permissions.is = getEventIs(event, user);
  permissions.special = [...permissions.special, ...getEventSpecial(event, user, permissions.is)];

  permissions.can.edit_organizers =
    canUserAccess({ user, accessObject: event.status.edit_organizers, event })
    || user.permissions.is.superadmin;

  permissions.can.edit_details =
    canUserAccess({ user, accessObject: event.status.edit_details, event })
    || user.permissions.is.superadmin;

  permissions.can.delete = permissions.can.edit_details;

  permissions.can.edit_application_status =
    canUserAccess({ user, accessObject: event.status.edit_application_status, event })
    || user.permissions.is.superadmin;

  permissions.can.edit =
    permissions.can.edit_details
    || permissions.can.edit_organizers
    || permissions.can.delete
    || permissions.can.edit_application_status
    || permissions.can.approve;

  /* permissions.can.apply =
    (!permissions.is.organizer && event.application_status === 'open')
    || permissions.is.superadmin; */

  permissions.can.approve_participants =
    (canUserAccess({ user, accessObject: event.status.approve_participants, event }) && event.application_status === 'closed')
    || user.permissions.is.superadmin;

  permissions.can.view_applications =
    canUserAccess({ user, accessObject: event.status.view_applications, event })
    || user.permissions.is.superadmin;

  return permissions;
}

exports.canUserAccess = canUserAccess;
exports.getEventPermissions = getEventPermissions;
exports.getBasicPermissions = getBasicPermissions;

exports.makeError = (res, statusCode, err, message) => {
  // 3 cases:
  // 1) 'err' is a string
  // 2) 'err' is a ValidationError
  // 3) 'err' is Error

  // If the error is a string, just forward it to user.
  if (typeof err === 'string') {
    return res.status(statusCode).json({
      success: false,
      message: err
    });
  }

  const msgText = message ? message + ' ' + err.message : err.message;

  // If the error is ValidationError, pass the errors details to the user.
  if (err.name && err.name === 'ValidationError') {
    return res.status(statusCode).json({
      success: false,
      message: msgText,
      errors: err.errors
    });
  }

  // Otherwise, just pass the error message.
  return res.status(statusCode).json({
    success: false,
    message: msgText
  });
};

exports.makeValidationError = (res, err, message) => exports.makeError(res, 422, err, message);
exports.makeForbiddenError = (res, err, message) => exports.makeError(res, 403, err, message);
exports.makeNotFoundError = (res, err, message) => exports.makeError(res, 404, err, message);
exports.makeInternalError = (res, err, message) => exports.makeError(res, 500, err, message);
exports.makeBadRequestError = (res, err, message) => exports.makeError(res, 400, err, message);
