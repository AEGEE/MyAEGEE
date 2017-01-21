const mongoose = require('mongoose');

exports = mongoose.Schema({
  users: [String], // ID of users,
  roles: [String], // IDs of roles
  bodies: [String],
  special: [String],
  // special are Public, Member, Organizer, Bodyadmin, Bodymember - dynamically
  // assigned roles based on the relation User and current Event
});
