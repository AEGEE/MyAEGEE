const mongoose = require('mongoose');

const eventTypeSchema = mongoose.Schema({
  defaultLifecycle: { type: mongoose.Schema.Types.ObjectId, ref: 'Lifecycle' },
  name: String,
});

module.exports = mongoose.model('EventType', eventTypeSchema);
