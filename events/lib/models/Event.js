const mongoose = require('../config/mongo');
const config = require('../config/config.js');

const Organizer = require('../schemas/Organizer');
const Participant = require('../schemas/Participant');
const Local = require('../schemas/Local');
const Location = require('../schemas/Location');
const Link = require('../schemas/Link');
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
  description: { type: String, default: '' },
  fee: {
    type: Number,
    get: v => Math.round(v * 100) / 100,
  },
  organizing_locals: [Local],
  links: [Link],
  locations: [Location],
  type: {
    type: String,
    enum: ['wu', 'es', 'nwm', 'ltc', 'rtc', 'local', 'other'],
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'requesting', 'approved'],
    required: true
  },
  max_participants: {
    type: Number,
    default: 0,
    get: v => Math.round(v),
  },
  application_deadline: Date,
  application_status: { type: String, enum: ['closed', 'open'], default: 'closed' },
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

// Allow virtuals
eventSchema.set('toJSON', { virtuals: true });
eventSchema.set('toObject', { virtuals: true });

// If application is closed, set all current applications to pending
eventSchema.pre('save', function save(next) {
  if (this.application_status === 'closed' && this.applications && this.applications.length > 0) {
    this.applications.forEach((item, index) => {
      if (this.applications[index].status === 'requesting') {
        this.applications[index].status = 'pending';
      }
    });
  }
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
  if (this.application_status === 'open' && !this.application_deadline) {
    this.invalidate('application_deadline', 'Cannot open the application without a deadline', this.application_deadline);
  }
  if (this.ends <= this.starts) {
    this.invalidate('ends', 'Event cannot end before it started', this.ends);
  }
  if (this.application_deadline && this.starts <= this.application_deadline) {
    this.invalidate('application_deadline', 'Application must end before the event starts', this.application_deadline);
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
