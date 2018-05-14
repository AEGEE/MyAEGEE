const mongoose = require('mongoose');

const eventRoleSchema = mongoose.Schema({
  cfg_id: String,
  name: String,
  description: String
});

module.exports = mongoose.model('EventRole', eventRoleSchema);
