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
	log.info('Hallo Welt');
	Event.find({}).select(['name', 'starts', 'ends', 'description', 'organizing_locals', 'type', 'status', 'max_participants', 'application_deadline', 'application_status'].join(' ')).exec(function(err, events) {
		if (err) {log.info(err);return next(new restify.InternalError());}
		
		res.json(events);
	});
}

exports.addEvent = function(req, res, next) {
	// Make sure the user doesn't insert malicious stuff
	// Fields with other names will be ommitted automatically by mongoose
	var data = req.body;
	delete data._id;
	delete data.status;
	delete data.applications;
	delete data.organizers;
	delete data.application_status;
	//delete data.organizing_locals;
	
	log.info('Creating new event %s', data);

	
	var newevent = new Event(data);
	// TODO Add current user to organizers list
	// TODO Add current user's local to organizing locals list
	newevent.save(function(err) {
		if(err)
			return next(new restify.InvalidContentError(JSON.stringify(err)));
		log.info('Created new event %s', newevent);
		delete newevent.applications;
		res.json(newevent);
	});
	
}

/** Single event **/

exports.eventDetails = function(req, res, next) {
	Event.findById(req.params.event_id).select(['-__v', '-applications', '-organizers'].join(' ')).exec(function(err, event) {
		if (err) {log.info(err);return next(new restify.InternalError());}
		if (event == null) 
			return next(new restify.NotFoundError("Event " + req.params.event_id + " not found"));
		
		res.json(event);
	});
}

exports.editEvent = function(req, res, next) {
	var data = req.body;
	// TODO Check for user privilegies
	// TODO Only allow edits for draft-events
	// TODO Only let CD/SUCT/EQUARK members change to approved
	delete data.applications;
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
		if (err) {log.info(err);return next(new restify.InternalError());}
		if (event == null) 
			return next(new restify.NotFoundError("Event " + req.params.event_id + " not found"));
		
		// Deletion is only changing status to deleted
		event.status = 'deleted';
		event.save(function(err) {
			if (err) {log.info(err);return next(new restify.InternalError());}

			res.send("Event successfully deleted");
		});
	});
}

/** Participants **/
exports.listParticipants = function(req, res, next) {
	// TODO Check for user privilegies
	// Idea: Only let people see applications after application period ended
	
	Event.findById(req.params.event_id).lean().exec(function(err, event) {
		if (err) {log.info(err);return next(new restify.InternalError());}
		if (event == null) 
			return next(new restify.NotFoundError("Event " + req.params.event_id + " not found"));
		
		event.applications.forEach(function(x, idx) {
			event.applications[idx].url = event.url + '/participants/' + event.applications[idx].foreign_id;
		});
		
		res.json(event.applications);
	});
}

exports.applyParticipant = function(req, res, next) {
	Event.findById(req.params.event_id, function(err, event) {
		if (err) {log.info(err);return next(new restify.InternalError());}
		if (event == null) 
			return next(new restify.NotFoundError("Event " + req.params.event_id + " not found"));

		var data = req.body;
		delete data.application_status;
		delete data.cache_first_name;
		delete data.cache_last_name;
		delete data._id;
		delete data.foreign_id;
		delete data.cache_update;
		
		// TODO insert user credentials of applying user
		// TODO check if user has applied already
		data.foreign_id = "cave.johnson";
		
		// Make sure only application fields which are defined in the event are filled
		var cleanApplication = {}
		data.application_fields.forEach(function(rule) {
			if(data.application.hasOwnProperty(rule.name))
				cleanApplication[rule.name] = data.application[rule.name];
		});
		delete data.application;
		data.application = cleanApplication;
		
		applications.push(data);
		
		event.save(function(err) {
			if (err) {log.info(err);return next(new restify.InternalError());}
			
			res.send(event.url + '/participants/' + data.id);
		});
	});
}

exports.getApplication = function(req, res, next) {
	Event.findById(req.params.event_id, function(err, event) {
		if (err) {log.info(err);return next(new restify.InternalError());}
		if (event == null) 
			return next(new restify.NotFoundError("Event " + req.params.event_id + " not found"));
		
		// TODO check user privilegies
		var application = events.applications.find(function(element) {return element == req.params.user_id;});
		if (application == undefined)
			return next(new restify.NotFoundError("User " + req.params.user_id + " not found"));
		
		res.json(application);
	});
}

exports.setApplication = function(req, res, next) {
	Event.findById(req.params.event_id, function(err, event) {
		if (err) {log.info(err);return next(new restify.InternalError());}
		if (event == null) 
			return next(new restify.NotFoundError("Event " + req.params.event_id + " not found"));
		
		// TODO check user privilegies
		var index;
		var application = events.applications.find(function(element, idx) {
			if(element == req.params.user_id) {
				index = idx;
				return true;
			}
			return false;
		});
		if (application == undefined)
			return next(new restify.NotFoundError("User " + req.params.user_id + " not found"));
		
		application = req.body;
		
		delete application.cache_first_name;
		delete application.cache_last_name;
		delete application.cache_update;
		delete application._id;
		delete application.foreign_id;
		// TODO Only let user change application status if organizer
		
		event.applications[index] = application;
		event.save(function(err) {
			if (err) {log.info(err);return next(new restify.InternalError());}
			
			res.json(application);
		});
	});
}

/** Organizers **/

exports.listOrganizers = function(req, res, next) {
	// TODO Check for permissions
	Event.findById(req.params.event_id).exec(function(err, event) {
		if (err) {log.info(err);return next(new restify.InternalError());}
		if (event == null) 
			return next(new restify.NotFoundError("Event " + req.params.event_id + " not found"));
		
		res.json(event.organizers);
	});
}

exports.addOrganizer = function(req, res, next) {
	Event.findById(req.params.event_id, function(err, event) {
		if (err) {log.info(err);return next(new restify.InternalError());}
		if (event == null) 
			return next(new restify.NotFoundError("Event " + req.params.event_id + " not found"));
		
		var data = req.body;
		delete data.cache_first_name;
		delete data.cache_last_name;
		delete data.cache_update;
		
		// TODO check if user-id really exists and fetch cached name
		event.organizers.push(data);
		event.save(function(err) {
			if (err) {log.info(err);return next(new restify.InternalError());}
			
			res.json(data);
		});
	});
}

exports.delOrganizer = function(req, res, next) {
	Event.findById(req.params.event_id, function(err, event) {
		if (err) {log.info(err);return next(new restify.InternalError());}
		if (event == null) 
			return next(new restify.NotFoundError("Event " + req.params.event_id + " not found"));
		if (req.params.user_id == undefined || req.params.user_id == "")
			return next(new restify.InvalidArgumentError("No user-id provided!"));
		
		// Remove all items fitting
		var changed = false;
		events.organizers = events.organizers.filter(function(item) { 
			if (item.foreign_id == req.params.user_id) {
				changed = true;
				return false;
			}
			return true;			
		});
		
		if(!changed)
			return next(new restify.NotFoundError("User " + req.params.user_id + " not found"));
		
		event.save(function(err) {
			if (err) {log.info(err);return next(new restify.InternalError());}
			
			res.json(data);
		});
	});
}

exports.setOrganizingLocals = function(req, res, next) {
	Event.findById(req.params.event_id, function(err, event) {
		if (err) {log.info(err);return next(new restify.InternalError());}
		if (event == null) 
			return next(new restify.NotFoundError("Event " + req.params.event_id + " not found"));
		
		// Validate data
		var data = req.body;
		if (data != undefined && Object.prototype.toString.call( data ) === '[object Array]') {
			data.forEach(function(item, idx) {
				delete data[idx].cache_name;
				delete data[idx].cache_update;
				// TODO Query for local's names
			});
		}
		else
			return next(new restify.InvalidContentError("Request malformed"));
			
		
		event.organizing_locals = data;
		event.save(function(err) {
			if (err) {log.info(err);return next(new restify.InternalError());}
			
			res.json(data);
		});
	});
}

exports.setApplicationFields = function(req, res, next) {
	Event.findById(req.params.event_id, function(err, event) {
		if (err) {log.info(err);return next(new restify.InternalError());}
		if (event == null) 
			return next(new restify.NotFoundError("Event " + req.params.event_id + " not found"));
		
		event.application_fields = req.body;
		event.save(function(err) {
			if (err) {log.info(err);return next(new restify.InternalError());}
			
			res.json(req.body);
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

exports.debug = function(req, res, next) {
	Event.remove({}, function(err) {
		res.send("All events removed");
	});
}
