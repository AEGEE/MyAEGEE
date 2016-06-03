var config = require('./config/config.json');
var log = require('./config/logger');

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
			events[index].url = 'events/single/' + event._id;
		});
		res.json(events);
	});
}

exports.addEvent = function(req, res) {
	var newevent = new Event(req.params);
	// TODO Add current user to organizers list
	newevent.save(function(err) {
		if(err) throw err;
		
		res.send('Created new event');
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
