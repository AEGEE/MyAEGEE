var mongoose = require('mongoose');

// A participant applying to an event including it's application
var paxSchema = mongoose.Schema({
	cache_first_name: String,
	cache_last_name: String,
	cache_update: Date, // When were cached lastname and firstname updated
	foreign_id: {type: String, required: true}, // ID in oms-core
	application_status: {type: String, enum: ['requesting', 'pending', 'approved', 'deleted'], default: 'requesting'},
	application: [{
		field_id: {type: String, required: true},
		value: String
	}]
});

var orgaSchema = mongoose.Schema({
	cache_first_name: String,
	cache_last_name: String,
	cache_update: Date,
	foreign_id: {type: String, required: true},
	role: {type: String, enum: ['full', 'readonly'], default: 'full'},
});

var localSchema =  mongoose.Schema({
	cache_name: String,
	cache_update: Date,
	foreign_id: {type: String, required: true},
});

var applicationFieldSchema =  mongoose.Schema({
	name: {type: String, required: true},
	// TODO Add validation, like
	//type: {type: String, enum: ['String', 'Number'], default: 'String'},
	//min_length: Number
});

var eventSchema =  mongoose.Schema({
	name: {type: String, required: true},
	starts: {type: Date, required: true},
	ends: {type: Date, required: true},
	description: {type: String, default: ''},
	organizing_locals: [localSchema],
	type: {type: String, enum: ['non-statutory', 'statutory', 'su'], default: 'non-statutory'},
	status: {type: String, enum: ['draft', 'requesting', 'approved', 'deleted'], default: 'draft'},
	max_participants: {type: Number, default: 0},
	application_deadline: Date,
	application_status: {type: String, enum: ['closed', 'open'], default: 'closed'},
	application_fields: [applicationFieldSchema],
	applications: [paxSchema],
	organizers: [orgaSchema],
	headImg: {type: String}, // url for the headimage
});
eventSchema.set('toJSON', {virtuals: true});
eventSchema.set('toObject', {virtuals: true});
eventSchema.virtual('url').get(function() {return '/single/' + this._id;});
eventSchema.virtual('application_url').get(function() {return this.url + '/participants';});
eventSchema.virtual('organizer_url').get(function() {return this.url + '/organizers';});
eventSchema.pre('save', function(next) {
	if(!this.application_fields || this.application_fields.length == 0) {
		this.application_fields = [{'name':'motivation'},{'name':'allergies'},{'name':'disabilities'}];
	}

	next();
});
eventSchema.pre('validate', function(next) {
	if(this.application_status == 'open' && this.status == 'draft')
		next(Error('Cannot open the application on a draft event'));
	else if(this.application_status == 'open' && this.application_deadline == null)
		next(Error('Cannot open the application without a deadline'));
	else
		next();
});


module.exports = mongoose.model('Event', eventSchema);
