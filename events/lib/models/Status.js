const mongoose = require('mongoose');
const AccessObject = require('./AccessObject');

const statusSchema = mongoose.Schema({
  name: String,
  visibility: AccessObject,
  applicable: AccessObject,
});

module.exports = mongoose.model('Status', statusSchema);
