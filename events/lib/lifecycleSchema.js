var mongoose = require('mongoose');
var config = require('./config/config.js');

var accessObjectSchema = mongoose.Schema({
	users: [String], // ID of users,
	roles: [String], // IDs of roles
	bodies: [String],
	special: [String], // special are Public, Member, Organizer, Bodyadmin, Bodymember - dynamically assigned roles based on the relation User and current Event 
});

var statusSchema = mongoose.Schema({
	name: String,
	visibility: accessObjectSchema,
	applicable: accessObjectSchema 
});

var transitionSchema = mongoose.Schema({
	from: {type: mongoose.Schema.Types.ObjectId, ref: 'Status'},
	to: {type: mongoose.Schema.Types.ObjectId, ref: 'Status'},
	allowedFor: accessObjectSchema,
});

var lifecycleSchema = mongoose.Schema({
	// id
	eventType: String,
	transitions: [transitionSchema],
	status: [statusSchema],
	initialStatus: statusSchema,
});

var eventTypeSchema = mongoose.Schema({
	defaultLifecycle: {type: mongoose.Schema.Types.ObjectId, ref: 'Lifecycle'},
	name: String
});