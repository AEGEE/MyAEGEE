const mongoose = require('mongoose');
const config = require('../config/config.js');
const orgaSchema = require('./Organizer.js');
const accessObject = require('./AccessObject');

// A participant applying to an event including it's application
const paxSchema = mongoose.Schema({
  first_name: String,
  last_name: String,
  antenna: String,
  antenna_id: { type: String, required: true },
  board_comment: String,
  foreign_id: { type: String, required: true }, // ID in oms-core
  application_status: {
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
}, { timestamps: true });
paxSchema.set('toJSON', { virtuals: true });

paxSchema.set('toObject', { virtuals: true });
paxSchema.virtual('url').get(function url() {
  return `${this.parent().application_url}/${this.foreign_id}`;
});

const localSchema = mongoose.Schema({
  name: String,
  foreign_id: { type: String, required: true },
});

const applicationFieldSchema = mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  optional: { type: Boolean, default: false },

  // TODO Add validation, like
  // type: {type: String, enum: ['String', 'Number'], default: 'String'},
  // min_length: Number
});

// A schema for storing per-event links to different microservices' features.
// The 'params' field is optional, because we won't need it all the time, I suppose.
// TODO: Add visibility field with the AccessObject
const linkSchema = mongoose.Schema({
  controller: { type: String, required: true },
  params: { type: mongoose.Schema.Types.Mixed },
  displayName: { type: String, required: true },
  visibility: { type: accessObject, required: true },
});

// A schema to store location data.
const locationSchema = mongoose.Schema({
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  name: { type: String, required: true },
});

const eventSchema = mongoose.Schema({
  url: { type: String, unique: true, sparse: true }, // defaults to _id, see pre-save hook
  head_image: {
    // url: String, virtual
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
  organizing_locals: [localSchema],
  links: [linkSchema],
  locations: [locationSchema],
  type: { type: String, required: true },
  status: { type: mongoose.Schema.Types.ObjectId, ref: 'Status', required: true },
  lifecycle: { type: mongoose.Schema.Types.ObjectId, ref: 'Lifecycle', required: true },
  max_participants: {
    type: Number,
    default: 0,
    get: v => Math.round(v),
  },
  application_deadline: Date,
  application_status: { type: String, enum: ['closed', 'open'], default: 'closed' },
  application_fields: [applicationFieldSchema],
  applications: [paxSchema],
  organizers: [orgaSchema],
  deleted: { type: Boolean, default: false },
}, { timestamps: true });

// Virtuals
eventSchema.virtual('head_image.url').get(function imageUrl() {
  if (this.head_image && this.head_image.filename) {
    return `${config.frontend.url}/${config.frontend.media_url}/headimages/${this.head_image.filename}`;
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
      if (this.applications[index].application_status === 'requesting') {
        this.applications[index].application_status = 'pending';
      }
    });
  }
  // If no url is given, default to the id
  if(!this.url)
    this.url = this.get('_id');

  next();
});

// Validators
eventSchema.path('max_participants')
  .validate(value => value >= 0, 'Participants number can not be negative');
eventSchema.path('fee')
  .validate(value => value >= 0, 'Fee can\'t be negative');
eventSchema.pre('validate', function validate(next) {
  if (this.application_status === 'open' && this.status === 'draft') {
    this.invalidate('application_status',
                    'Cannot open the application on a draft event',
                    this.application_status);
  }
  if (this.application_status === 'open' && this.application_deadline === null) {
    this.invalidate('application_deadline',
                    'Cannot open the application without a deadline',
                    this.application_deadline);
  }
  if (this.ends <= this.starts) {
    this.invalidate('ends',
                    'Event cannot end before it started',
                    this.ends);
  }
  if (this.application_deadline != null && this.starts <= this.application_deadline) {
    this.invalidate('application_deadline',
                    'Application must end before the event starts',
                    this.application_deadline);
  }
  if (this.organizers == null || this.organizers.length === 0) {
    this.invalidate('organizers', 'Organizers list can not be empty', this.organizers);
  }

  next();
});

module.exports = mongoose.model('Event', eventSchema);
