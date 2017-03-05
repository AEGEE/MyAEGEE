const mongoose = require('mongoose');
const AccessObject = require('./AccessObject');

const transitionSchema = mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'Status' },
  to: { type: mongoose.Schema.Types.ObjectId, ref: 'Status' },
  allowedFor: AccessObject,
});

const lifecycleSchema = mongoose.Schema({
  // id
  eventType: String,
  transitions: [transitionSchema],
  status: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Status' }],
  initialStatus: { type: mongoose.Schema.Types.ObjectId, ref: 'Status' },
});

module.exports = mongoose.model('Lifecycle', lifecycleSchema);
