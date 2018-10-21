const mongoose = require('mongoose');

exports = mongoose.Schema({
  users: [String], // IDs of users
  circles: [String], // IDs of circles
  bodies: [String], // IDs of bodies
  special: [String],
  // special are Public, Member, Organizer, Bodyadmin, Bodymember - dynamically
  // assigned roles based on the relation User and current Event
}, { _id: false });
