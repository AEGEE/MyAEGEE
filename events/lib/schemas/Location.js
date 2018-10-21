const mongoose = require('mongoose');

// A schema to store location data.
const Location = mongoose.Schema({
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  name: { type: String, required: true },
});

module.exports = Location;
