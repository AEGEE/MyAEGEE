var mongoose = require('mongoose');

// A participant applying to an event including it's application
var paxSchema = mongoose.Schema({
	first_name: String,
	last_name: String,
	antenna: String,
	antenna_id: String,
	board_comment: String,
	foreign_id: {type: String, required: true}, // ID in oms-core
	application_status: {type: String, enum: ['requesting', 'pending', 'accepted', 'rejected'], default: 'requesting'},
	application: [{
		field_id: {type: String, required: true},
		value: String
	}]
}, {timestamps: true});
paxSchema.set('toJSON', {virtuals: true});
paxSchema.set('toObject', {virtuals: true});
paxSchema.virtual('url').get(function() {
	return this.parent().application_url + '/' + this.foreign_id;
});

var orgaSchema = mongoose.Schema({
	first_name: String,
	last_name: String,
	foreign_id: {type: String, required: true},
	role: {type: String, enum: ['full', 'readonly'], default: 'full'},
});

var localSchema =  mongoose.Schema({
	name: String,
	foreign_id: {type: String, required: true},
});

var applicationFieldSchema =  mongoose.Schema({
	name: {type: String, required: true},
	description: String,
	optional: {type: Boolean, default: false},
	// TODO Add validation, like
	//type: {type: String, enum: ['String', 'Number'], default: 'String'},
	//min_length: Number
});

var eventSchema =  mongoose.Schema({
	name: {type: String, required: true},
	starts: {type: Date, required: true},
	ends: {type: Date, required: true},
	description: {type: String, default: ''},
	fee: {
		type: Number,
		get: v => Math.round(v*100) / 100,
		set: v => Math.round(v*100) / 100
	},
	organizing_locals: [localSchema],
	type: {type: String, enum: ['non-statutory', 'statutory', 'su', 'local'], default: 'non-statutory'},
	status: {type: String, enum: ['draft', 'requesting', 'approved', 'deleted'], default: 'draft'},
	max_participants: {
		type: Number, 
		default: 0,
		get: v => Math.round(v),
		set: v => Math.round(v)
	},
	application_deadline: Date,
	application_status: {type: String, enum: ['closed', 'open'], default: 'closed'},
	application_fields: [applicationFieldSchema],
	applications: [paxSchema],
	organizers: [orgaSchema],
	headImg: {type: String}, // url for the headimage
}, {timestamps: true});
eventSchema.set('toJSON', {virtuals: true});
eventSchema.set('toObject', {virtuals: true});

// Validators
eventSchema.path('max_participants').validate(value => value >= 0, 'Participants number can not be negative');
eventSchema.path('fee').validate(value => value >= 0, 'Fee can\'t be negative');

eventSchema.pre('validate', function(next) {
	if(this.application_status == 'open' && this.status == 'draft')
		this.invalidate('application_status', 'Cannot open the application on a draft event', this.application_status);
	if(this.application_status == 'open' && this.application_deadline == null)
		this.invalidate('application_deadline', 'Cannot open the application without a deadline', this.application_deadline);
	if(this.ends <= this.starts)
		this.invalidate('ends', 'Event cannot end before it started', this.ends);
	if(this.application_deadline != null && this.starts <= this.application_deadline)
		this.invalidate('application_deadline', 'Application must end before the event starts', this.application_deadline);
	if(this.organizers == null || this.organizers.length == 0)
		this.invalidate('organizers', 'Organizers list can not be empty', this.organizers);
	
	next();
});


module.exports = mongoose.model('Event', eventSchema);
