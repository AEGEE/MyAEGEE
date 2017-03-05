var mongoose = require('mongoose');

const commentSchema = mongoose.Schema({
  event_id: { type: String, required: true, index: true },
  user: {
    foreign_id: { type: String, required: true },
    antenna_id: { type: String, required: true },
    antenna_name: String,
    name: String,
    profile_url: String,
  },
  comment: String,
}, { timestamps: true });
commentSchema.set('toJSON', { virtuals: true });
commentSchema.set('toObject', { virtuals: true });

exports = mongoose.model('Comment', commentSchema);
