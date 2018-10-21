const mongoose = require('../config/mongo');

const eventRoleSchema = mongoose.Schema({
  cfg_id: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, required: true }
});

module.exports = mongoose.model('EventRole', eventRoleSchema);
