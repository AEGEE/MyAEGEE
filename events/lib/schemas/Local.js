const mongoose = require('mongoose');

const Local = mongoose.Schema({
  body_id: { type: Number, required: true },
});

module.exports = Local;
