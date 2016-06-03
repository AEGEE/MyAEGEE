var mongoose = require('mongoose');

// A participant applying to an event
var paxSchema = mongoose.Schema({
	first_name: String,
	last_name: String,
	id: String, // ID in oms-core
	application_status: {type: String, enum: ['requesting', 'pending', 'approved'], default: 'requesting'},
	});

var orgaSchema = mongoose.Schema({
	first_name: String,
	last_name: String,
	id: String,
	application_status: {type: String, enum: ['requesting', 'approved'], default: 'requesting'},
})

var eventSchema = mongoose.Schema({
	name: {type: String, required: [true, 'No name given']},
	starts: Date,
	ends: Date,
	description: String,
	organizing_local: {
		name: String,
		id: String,
	},
	type: {type: String, enum: ['non-statutory', 'statutory', 'su'], default: 'non-statutory'},
	status: {type: String, enum: ['requesting', 'approved'], default: 'requesting'},
	max_participants: Number,
	participants: [paxSchema],
	organizer: [orgaSchema],
});

module.exports = mongoose.model('Event', eventSchema);
