const mongoose = require('mongoose');
const AccessObject = require('./AccessObject');

const statusSchema = mongoose.Schema({
  name: { type: String, required: true },
  visibility: { type: AccessObject, required: true },
  applicable: { type: AccessObject, required: true },
  edit_details: { type: AccessObject, required: true },
  edit_organizers: { type: AccessObject, required: true }
});

module.exports = statusSchema;
