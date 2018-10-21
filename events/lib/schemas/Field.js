const mongoose = require('mongoose');

const Field = mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  optional: { type: Boolean, default: false },

  // TODO Add validation, like
  // type: {type: String, enum: ['String', 'Number'], default: 'String'},
  // min_length: Number
});

module.exports = Field;
