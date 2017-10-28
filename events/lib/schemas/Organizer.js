const mongoose = require('mongoose');

var organizersSchema = mongoose.Schema({
  comment: String,
  foreign_id: { type: String, required: true },
  roles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'EventRole' }],
  // data: {} will be filled by populate method
});

// Populate data with the UserCache
organizersSchema.virtual('cached', {
	ref: 'UserCache',
	localField: 'foreign_id',
	foreignField: 'foreign_id'
});

module.exports = organizersSchema;