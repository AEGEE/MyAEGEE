var mongoose = require('mongoose');

// A participant applying to an event including it's application
var paxSchema = mongoose.Schema({
	cache_first_name: String,
	cache_last_name: String,
	cache_update: Date, // When were cached lastname and firstname updated
	id: String, // ID in oms-core
	application_status: {type: String, enum: ['requesting', 'pending', 'approved'], default: 'requesting'},
	application: mongoose.Schema.Types.Mixed,
});

var orgaSchema = mongoose.Schema({
	cache_first_name: String,
	cache_last_name: String,
	cache_update: Date,
	id: String,
	application_status: {type: String, enum: ['requesting', 'approved'], default: 'requesting'},
	role: {type: String, enum: ['write', 'read'], default: 'write'},
});

var localSchema = mongoose.Schema({
	cache_name: String,
	cache_update: Date,
	id: String
});

var applicationFieldSchema = mongoose.Schema({
	name: {type: String, required: true},
	// TODO Add validation, like
	//type: {type: String, enum: ['String', 'Number'], default: 'String'},
	//min_length: Number
});

var eventSchema = mongoose.Schema({
	name: {type: String, required: [true, 'No name given']},
	starts: Date,
	ends: Date,
	description: String,
	organizing_locals: [localSchema],
	type: {type: String, enum: ['non-statutory', 'statutory', 'su'], default: 'non-statutory'},
	status: {type: String, enum: ['draft', 'requesting', 'approved'], default: 'draft'},
	max_participants: Number,
	application_deadline: Date,
	application_status: {type: String, enum: ['closed', 'open'], default: 'closed'},
	application_fields: [applicationFieldSchema],
	participants: [paxSchema],
	organizers: [orgaSchema],
});

module.exports = mongoose.model('Event', eventSchema);
