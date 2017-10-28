const mongoose = require('mongoose');

exports = mongoose.Schema({
  users: { type: [String], required: true }, // ID of users,
  roles: { type: [String], required: true }, // IDs of roles
  bodies: { type: [String], required: true },
  special: { type: [String], required: true },
  // special are Public, Member, Organizer, Bodyadmin, Bodymember - dynamically
  // assigned roles based on the relation User and current Event
}, { _id: false });
