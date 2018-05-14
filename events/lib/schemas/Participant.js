const mongoose = require('mongoose');

// A participant applying to an event including it's application
const Participant = mongoose.Schema({
  board_comment: String,
  user_id: { type: String, required: true }, // ID in oms-core
  body_id: { type: String, required: true }, // body ID in oms-core
  status: {
    type: String,
    enum: ['requesting', 'pending', 'accepted', 'rejected'],
    default: 'requesting',
  },
  application:
  [
    {
      field_id: { type: String, required: true },
      value: String,
    },
  ],
}, { _id: false, timestamps: true });
Participant.set('toJSON', { virtuals: true });
Participant.set('toObject', { virtuals: true });
Participant.virtual('url').get(function url() {
  return `${this.parent().application_url}/${this.user_id}`;
});

module.exports = Participant;
