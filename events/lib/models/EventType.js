const mongoose = require('mongoose');
const Lifecycle = require('../schemas/Lifecycle');

const eventTypeSchema = mongoose.Schema({
  defaultLifecycle: { type: Lifecycle, required: true },
  name: { type: String, required: true },
});

module.exports = mongoose.model('EventType', eventTypeSchema);
