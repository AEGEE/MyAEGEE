const mongoose = require('mongoose');

// A schema to store location data.
const Location = mongoose.Schema({
  position: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  name: { type: String, required: true },
});

module.exports = Location;
