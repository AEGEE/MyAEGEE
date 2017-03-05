const mongoose = require('mongoose');
const AccessObject = require('./AccessObject');

const statusSchema = mongoose.Schema({
  name: String,
  visibility: AccessObject,
  applicable: AccessObject,
  edit_details: AccessObject,
  edit_organizers: AccessObject
});

module.exports = mongoose.model('Status', statusSchema);
