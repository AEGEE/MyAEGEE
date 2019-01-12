const moment = require('moment');

const mongoose = require('../config/mongo');
const config = require('../config/config.js');

const Organizer = require('../schemas/Organizer');
const Participant = require('../schemas/Participant');
const Local = require('../schemas/Local');
const Location = require('../schemas/Location');
const Field = require('../schemas/Field');

const eventSchema = mongoose.Schema({
  url: { type: String, unique: true, sparse: true }, // defaults to _id, see pre-save hook
  head_image: {
    path: String,
    filename: String,
  },
  name: { type: String, required: true },
  starts: { type: Date, required: true },
  ends: { type: Date, required: true },
  description: { type: String, required: true },
  fee: {
    type: Number,
    get: v => Math.round(v * 100) / 100,
    required: true,
    default: 0
  },
  organizing_locals: [Local],
  locations: [Location],
  type: {
    type: String,
    enum: ['wu', 'es', 'nwm', 'ltc', 'rtc', 'local', 'other'],
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'requesting', 'published'],
    required: true,
    default: 'draft'
  },
  max_participants: {
    type: Number,
    default: 0,
    get: v => Math.round(v),
  },
  application_starts: {
    type: Date,
    required: true
  },
  application_ends: {
    type: Date,
    required: true
  },
  application_fields: [Field],
  applications: [Participant],
  organizers: [Organizer],
  deleted: { type: Boolean, default: false },
}, { timestamps: true, minimize: false });

// Virtuals
eventSchema.virtual('head_image.url').get(function imageUrl() {
  if (this.head_image && this.head_image.filename) {
    return `${config.media_url}/headimages/${this.head_image.filename}`;
  }
  return '';
});

eventSchema.virtual('application_status').get(function getStatus() {
  return moment().isBetween(this.application_starts, this.application_ends, null, '[]')
    ? 'open'
    : 'closed';
})

// Allow virtuals
eventSchema.set('toJSON', { virtuals: true });
eventSchema.set('toObject', { virtuals: true });

// If application is closed, set all current applications to pending
eventSchema.pre('save', function save(next) {
  // If no url is given, default to the id
  if (!this.url) {
    this.url = this.get('_id');
  }

  next();
});

// Validators
eventSchema.path('max_participants').validate(value => value >= 0, 'Participants number can not be negative');
eventSchema.path('fee').validate(value => value >= 0, 'Fee can\'t be negative');

eventSchema.pre('validate', function validate(next) {
  if (this.applications_ends <= this.applications_starts) {
    this.invalidate('ends', 'Event applications cannot end before it started', this.applications_ends);
  }
  if (this.starts <= this.applications_ends) {
    this.invalidate('ends', 'Event applications cannot end after the event has started', this.starts);
  }
  if (this.ends <= this.starts) {
    this.invalidate('ends', 'Event cannot end before it started', this.ends);
  }
  if (this.organizers == null || this.organizers.length === 0) {
    this.invalidate('organizers', 'Organizers list can not be empty', this.organizers);
  }
  if (this.organizing_locals == null || this.organizing_locals.length === 0) {
    this.invalidate('organizing_locals', 'Organizing locals list can not be empty', this.organizing_locals);
  }

  next();
});

module.exports = mongoose.model('Event', eventSchema);
