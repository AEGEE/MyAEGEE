const mongoose = require('mongoose');

const organizersSchema = mongoose.Schema({
  comment: String,
  user_id: { type: Number, required: true },
  roles: { type: [String], required: false },
}, { minimize: false });

module.exports = organizersSchema;
