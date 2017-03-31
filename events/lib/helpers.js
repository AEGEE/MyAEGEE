const httprequest = require('request');
const config = require('./config/config.js');

exports.checkApplicationValidity = (application, applicationFields) => {
  // Check if every field in the application array resembles to a field in event.applicationFields
  if (application === undefined || Object.prototype.toString.call(application) !== '[object Array]') {
    return { passed: false, msg: 'Not an array' };
  }
  if (application.length > applicationFields.length) {
    return { passed: false, msg: 'Application too long' };
  }

  // O(N*N), let's hope applications don't get big
  let error = false;
  application.forEach((userField) => {
    if (applicationFields
        .find(applicationField => applicationField._id === userField.field_id) === undefined) {
      error = true;
    }
  });

  if (error) {
    return { passed: false, msg: 'Invalid field_id' };
  }

  // TODO Check for duplicate fields

  return { passed: true, msg: '' };
};



exports.getEventPermissions = (event, user) => {
  const permissions = {
    is: {},
    can: {},
    special: [],
  };

  if (!event || !user) {
    return permissions;
  }

  permissions.is.organizer = event.organizers.some(item => item.foreign_id == user.basic.id);

  let applicationIndex;

  // TODO remove
  {
    permissions.is.participant = event.applications.some((item, index) => {
      if (item.foreign_id == user.basic.id) {
        applicationIndex = index;
        return true;
      }

      return false;
    });

    permissions.is.accepted_participant = permissions.is.participant &&
      event.applications[applicationIndex].application_status === 'accepted';
  }

  permissions.is.own_antenna = event.organizing_locals.some(item =>
    item.foreign_id == user.basic.antenna_id);


  permissions.can.edit_organizers = permissions.is.organizer;

  permissions.can.edit_details =
    (permissions.is.organizer &&
     event.application_status === 'closed') // && event.status === 'draft')  TODO add lifecycle awareness
    || permissions.is.superadmin;

  permissions.can.delete = permissions.can.edit_details;

  permissions.can.edit_application_status =
    (permissions.is.organizer) // && event.status === 'approved') TODO not valid with lifecycle anymore
    || permissions.is.superadmin;

  // TODO: probably remove this one, since we have the lifecycle workflow
  permissions.can.approve =
    event.application_status === 'closed' || permissions.is.superadmin;

  permissions.can.edit =
    permissions.can.edit_details
    || permissions.can.edit_organizers
    || permissions.can.delete
    || permissions.can.edit_application_status
    || permissions.can.approve;

  permissions.can.apply =
    (!permissions.is.organizer && event.application_status === 'open')
    || permissions.is.superadmin;

  permissions.can.approve_participants = permissions.is.organizer &&
    event.application_status === 'closed';

  permissions.can.view_applications =
    permissions.is.organizer
    || (permissions.is.boardmember && permissions.is.own_antenna)
    || permissions.is.superadmin;

  // Special roles
  if (permissions.is.boardmember && permissions.is.own_antenna) // TODO that doesn't work that way, boardmember is generic for all boardmembers
    permissions.special.push('Organizing Board Member');
  if (permissions.is.own_antenna)
    permissions.special.push('Organizing Local Member');
  if (permissions.is.organizer) {
    permissions.special.push('Organizer');
  }

  // Also all eventroles become special roles
  var myorg = event.organizers.find((item) => item.foreign_id == user.basic.id);
  if(myorg && myorg.roles && myorg.roles.length > 0) {
    myorg.roles.forEach((item) => {
      permissions.special.push(item.name);
    });
  }

  return permissions;
};
