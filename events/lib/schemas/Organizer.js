const mongoose = require('mongoose');
const EventRole = require('../models/EventRole');

var organizersSchema = mongoose.Schema({
  comment: String,
  foreign_id: { type: Number, required: true },
  roles: [{ type: EventRole.schema, required: false }],
}, { minimize: false });

// Populate data with the UserCache
organizersSchema.virtual('cached', {
  ref: 'UserCache',
  localField: 'foreign_id',
  foreignField: 'foreign_id'
});

module.exports = organizersSchema;
