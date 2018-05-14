const mongoose = require('mongoose');

const Local = mongoose.Schema({
  name: String,
  body_id: { type: String, required: true },
});

module.exports = Local;
