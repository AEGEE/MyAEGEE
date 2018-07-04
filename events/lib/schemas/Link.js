const mongoose = require('mongoose');
const AccessObject = require('./AccessObject');

// A schema for storing per-event links to different microservices' features.
// The 'params' field is optional, because we won't need it all the time, I suppose.
const Link = mongoose.Schema({
  controller: { type: String, required: true },
  params: { type: mongoose.Schema.Types.Mixed },
  displayName: { type: String, required: true },
  visibility: { type: AccessObject, required: true },
});

module.exports = Link;
