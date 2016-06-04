var config = require('./config/config.json');
var log = require('./config/logger');
var restify = require('restify');
var mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect(config.mongourl);
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));

var Event = require('./eventModel');

var stats = {
	requests: 0,
	started: Date.now()
}

/** Requests for all events **/

exports.listEvents = function(req, res) {
	
	Event.find({}).lean().exec(function(err, events) {
		// TODO: do this inside the query, not in JS
		events.forEach(function(event, index, events) {
			delete events[index].participants;
			delete events[index].__v;
			events[index].reg_organizers = event.organizers.length;
			delete events[index].organizers;
			delete events[index].application_fields;
			events[index].url = '/events/single/' + event._id;
		});
		
		res.json(events);
	});
}

exports.addEvent = function(req, res, next) {
	// Make sure the user doesn't insert malicious stuff
	// Fields with other names will be ommitted automatically by mongoose
	var data = req.body;
	delete data._id;
	delete data.status;
	delete data.participants;
	delete data.organizers;
	delete data.application_status;
	delete data.organizing_locals;
	
	var newevent = new Event(data);
	// TODO Add current user to organizers list
	// TODO Add current user's local to organizing locals list
	newevent.save(function(err) {
		if(err)
			return next(new restify.InvalidContentError(JSON.stringify(err)));
		
		res.send('Created new event');
	});
}

/** Single event **/

exports.eventDetails = function(req, res, next) {
	Event.findById(req.params.event_id).lean().exec(function(err, event) {
		if(err) throw err;
		if (event == null) 
			return next(new restify.NotFoundError("Event " + req.params.event_id + " not found"));
		
		delete event.__v;
		delete event.participants;

		res.json(event);
	});
}

exports.editEvent = function(req, res, next) {
	var data = req.body;
	// TODO Check for user privilegies
	delete data.participants;
	delete data.organizers;
	Event.findByIdAndUpdate(req.params.event_id, data, function(err, event) {
		if (err)
			return next(new restify.InvalidContentError(JSON.stringify(err)));
		
		res.json(event);
	});
}

exports.deleteEvent = function(req, res, next) {
	// TODO Check for user privilegies
	Event.findById(req.params.event_id, function(err, event) {
		if (err) 
			throw err;
		if (event == null) 
			return next(new restify.NotFoundError("Event " + req.params.event_id + " not found"));
				   
		event.remove(function(err) {
			if (err) throw err;
					 
			res.send("Event successfully deleted");
		});
	});
}

/** Participants **/
exports.listParticipants = function(req, res, next) {
	Event.findById(req.params.event_id).lean().exec(function(err, event) {
		if (err)
			return next(new restify.InternalError(err));
		if (event == null) 
			return next(new restify.NotFoundError("Event " + req.params.event_id + " not found"));
		
		res.json(event.participants);
	});
}

exports.applyParticipant = function(req, res, next) {
	Event.findById(req.params.event_id, function(err, event) {
		if (err)
			return next(new restify.InternalError());
		if (event == null) 
			return next(new restify.NotFoundError("Event " + req.params.event_id + " not found"));
		
		// TODO insert user credentials of applying user
		var data = req.body;
		delete data.application_status;
		delete data.cache_first_name;
		delete data.cache_last_name;
		delete data.id;
		delete data.cache_update;
		
		// Make sure only application fields which are defined in the event are filled
		var cleanApplication = {}
		data.application_fields.forEach(function(rule) {
			if(data.application.hasOwnProperty(rule.name))
				cleanApplication[rule.name] = data.application[rule.name];
		});
		delete data.application;
		data.application = cleanApplication;
		
		participants.push(data);
		
		event.save(function(err) {
			if(err)
				return next(new restify.InternalError());
			
			res.send("Your application as participant has been recorded.");
		});
	});
}


/** Nerdporn Requests **/

exports.countRequests = function(req, res, next) {
	stats.requests++;
	next();
}

exports.status = function(req, res) {
	var ret = {
		requests: stats.requests,
		uptime: ((new Date).getTime() - stats.started) / 1000,
		secret: config.secret
	}
	res.json(ret);
}

exports.debug = function(req, res) {
	var newevent = Event({
		name: 'Develop Yourself 2',
		starts: new Date(2015, 12, 11, 15, 00),
		ends: new Date(2015, 12, 14, 12, 00),
		description: 'Training event',
		max_participants: 22,
		something: 'Hallihallo'
	});
	
	newevent.save(function(err) {
		if(err) throw err;
		
		res.send('Created new event');
	});
}
