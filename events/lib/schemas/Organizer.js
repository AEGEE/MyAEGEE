const mongoose = require('mongoose');
const EventRole = require('../models/EventRole');

const organizersSchema = mongoose.Schema({
  comment: String,
  user_id: { type: Number, required: true },
  roles: [{ type: EventRole.schema, required: false }],
}, { minimize: false });

module.exports = organizersSchema;
