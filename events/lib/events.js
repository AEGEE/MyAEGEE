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

		events.forEach(function(event, index, events) {
			events[index].enrolled_participants = event.participants.filter(function(x){return x.application_status == 'enrolled'}).length;
			delete events[index].participants;
			delete events[index].__v;
			events[index].organizers = event.organizer.length;
			delete events[index].organizer;
			events[index].url = '/events/single/' + event._id;
		});
		res.json(events);
	});
}

exports.addEvent = function(req, res) {
	// Make sure the user doesn't insert malicious stuff
	// Fields with other names will be ommitted automatically by mongoose
	var data = req.body;
	delete data._id;
	delete data.status;
	delete data.participants;
	delete data.organizer;
	
	var newevent = new Event(data);
	// TODO Add current user to organizers list
	newevent.save(function(err) {
		if(err) throw err;
		
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


/** Nerdporn Requests **/

exports.countRequests = function(req, res, next) {
	stats.requests++;
	next();
}

exports.status = function(req, res) {
	var ret = {
		requests: stats.requests,
		uptime: ((new Date).getTime() - stats.started) / 1000
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
