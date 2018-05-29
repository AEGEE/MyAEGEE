const mongoose = require('mongoose');

const Local = mongoose.Schema({
  body_id: { type: String, required: true },
});

module.exports = Local;
