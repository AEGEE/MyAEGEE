const mongoose = require('mongoose');
const AccessObject = require('./AccessObject');

const statusSchema = mongoose.Schema({
  name: { type: String, required: true },
  visibility: { type: AccessObject, required: true },
  applicable: { type: AccessObject, required: true },
  edit_details: { type: AccessObject, required: true },
  edit_organizers: { type: AccessObject, required: true },
  edit_application_status: { type: AccessObject, required: true },
  approve_participants: { type: AccessObject, required: true },
  view_applications: { type: AccessObject, required: true }
}, { _id: false, minimize: false });

module.exports = statusSchema;
