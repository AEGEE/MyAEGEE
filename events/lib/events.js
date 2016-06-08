var config = require('./config/config.json');
var log = require('./config/logger');
var restify = require('restify');
var mongoose = require('mongoose');
var helpers = require('./helpers');

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

exports.listEvents = function(req, res, next) {
	Event.find({}).select(['name', 'starts', 'ends', 'description', 'organizing_locals', 'type', 'status', 'max_participants', 'application_deadline', 'application_status'].join(' ')).exec(function(err, events) {
		if (err) {log.info(err);return next(new restify.InternalError());}
		
		res.json(events);
		return next();
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
		delete newevent.applications;
		res.json(newevent);
		return next();
	});
}

/** Single event **/

exports.eventDetails = function(req, res, next) {
	Event.findById(req.params.event_id).select(['-__v'].join(' ')).exec(function(err, event) {
		if (err) {log.info(err);return next(new restify.InternalError());}
		if (event == null) 
			return next(new restify.NotFoundError("Event " + req.params.event_id + " not found"));
		
		var event = event.toObject();
		
		// TODO: Check if user is allowed to see this, meaning is organizer or participant
		if(event.application_status == 'open')
			delete event.applications;
		
		// TODO: Check if user is allowed to see this, meaning is organizer
		// delete event.organizers;
		
		res.json(event);
		return next();
	});
}

exports.editEvent = function(req, res, next) {
	var data = req.body;
	// TODO Check if user is organizer
	delete data.applications;
	delete data.organizers;
	Event.findById(req.params.event_id, function(err, event) {
		if (err) {log.info(err);return next(new restify.InternalError());}
		if (event == null) 
			return next(new restify.NotFoundError("Event " + req.params.event_id + " not found"));
		
		// TODO: CD/SUCT/EQUARK can still edit even if not in draft
		if (event.status != 'draft'){
			delete event.name;
			delete event.starts;
			delete event.ends;
			delete event.description;
			delete event.type;
			delete event.application_fields;
		}
		
		// TODO Only let CD/SUCT/EQUARK members change to approved
		
		// TODO If organizing local is set, retrieve name for that
		
		for (var key in data) {
			event[key] = data[key];
		}
		
		event.save(function(err) {
			if (err) {log.info(err);return next(new restify.InternalError());}
			
			var retval = event.toObject();
			delete retval.applications;
			delete retval.organizers;
			delete retval.__v;
			
			res.json(retval);
			return next();
		});
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
			return next();
		});
	});
}

/** Participants **/
exports.listParticipants = function(req, res, next) {
	// TODO Check for user privilegies
	// Idea: Only let people see applications after application period ended
	
	Event.findById(req.params.event_id).exec(function(err, event) {
		if (err) {log.info(err);return next(new restify.InternalError());}
		if (event == null) 
			return next(new restify.NotFoundError("Event " + req.params.event_id + " not found"));
		
		var applications = event.applications.toObject();
		
		applications.forEach(function(x, idx) {
			applications[idx].url = event.url + '/participants/' + applications[idx].foreign_id;
		});
		
		res.json(applications);
		return next();
	});
}

exports.applyParticipant = function(req, res, next) {
	Event.findById(req.params.event_id).exec(function(err, event) {
		if (err) {log.info(err);return next(new restify.InternalError());}
		if (event == null) 
			return next(new restify.NotFoundError("Event " + req.params.event_id + " not found"));
		//if (event.application_status != 'open')
		//	return next(new restify.ForbiddenError('Event not open for applications'));

		var data = {application: req.body.application};
		var tmp = helpers.checkApplicationValidity(data.application, event.application_fields);
		if (!tmp.passed)
			return next(new restify.InvalidContentError('Application malformed: ' + tmp.msg));
		

		// TODO insert user credentials of applying user
		data.foreign_id = "cave.johnson" + Math.floor((Math.random() * 3) + 1);
		
		if(event.applications.find(function(element){return element.foreign_id == data.foreign_id;}) != undefined)
			return next(new restify.ConflictError('You have already applied!'));

		event.applications.push(data);
		

		
		event.save(function(err) {
			if (err) {log.info(err);return next(new restify.InternalError());}
			log.info('Saved');
			res.setHeader('Location', event.url + '/participants/' + data.foreign_id);
			res.send(201, 'Your application as participant has been recorded.');
			return next();
		});
	});
	
}

exports.getApplication = function(req, res, next) {
	Event.findById(req.params.event_id, function(err, event) {
		if (err) {log.info(err);return next(new restify.InternalError());}
		if (event == null) 
			return next(new restify.NotFoundError("Event " + req.params.event_id + " not found"));
		
		// TODO check user privilegies
		// Search for the application
		var application = event.applications.find(function(element) {return element.foreign_id == req.params.user_id;});
		if (application == undefined)
			return next(new restify.NotFoundError("User " + req.params.user_id + " not found"));
		
		res.json(application);
		return next();
	});
	
}

exports.setApplication = function(req, res, next) {
	Event.findById(req.params.event_id, function(err, event) {
		if (err) {log.info(err);return next(new restify.InternalError());}
		if (event == null) 
			return next(new restify.NotFoundError("Event " + req.params.event_id + " not found"));
		
		// TODO check user privilegies
		
		// Find the corresponding application
		var index;
		var application = event.applications.find(function(element, idx) {
			if(element.foreign_id == req.params.user_id) {
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
		// TODO Only let user change application status if organizer and application is closed
		if(application.application_status) {
			event.applications[index].application_status = application.application_status;  // Just copy the field
		}
		
		// If the user changed it's application, check for validity
		if(application.application) {
			var tmp = helpers.checkApplicationValidity(application.application, event.application_fields);
			if (!tmp.passed)
				return next(new restify.InvalidContentError('Application malformed: ' + tmp.msg));
			event.applications[index].application = application.application;  // Copies the field
		}
	
		event.save(function(err) {
			if (err) {log.info(err);return next(new restify.InternalError());}
			
			res.json(event.applications[index]);
			return next();
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
		
		var data = event.organizers.toObject();
		data.forEach(function(x, idx) {
			data[idx].url = event.url + '/organizers/' + x.foreign_id;
		});
		
		res.json(data);
		return next();
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
		
		if(!data.foreign_id)
			return next(new restify.InvalidContentError("No foreign id provided"));
		
		// Check if user is organizer already
		if(event.organizers.find(function(element) {return element.foreign_id == data.foreign_id;}) != undefined)
			return next(new restify.ConflictError("User is registered as organizer already"));
		
		// TODO check if user-id really exists and fetch cached name
		event.organizers.push(data);
		event.save(function(err) {
			if (err) {log.info(err);return next(new restify.InternalError());}
			res.status(201);
			res.setHeader('Location', event.url + '/organizers/' + data.foreign_id);
			res.send("User was successfully added to organizers");
			return next();
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
		event.organizers = event.organizers.filter(function(item) { 
			if (item.foreign_id == req.params.user_id) {
				changed = true;
				return false;
			}
			return true;			
		});
		
		if(!changed)
			return next(new restify.NotFoundError("User " + req.params.user_id + " not found"));
		
		if(event.organizers.length == 0)
			return next(new restify.ConflictError("An event needs to have at least 1 organizer"));
		
		event.save(function(err) {
			if (err) {log.info(err);return next(new restify.InternalError());}
			
			res.send("User was deleted as organizer");
			return next();
		});
	});
	
}

/** Nerdporn Requests **/

exports.countRequests = function(req, res, next) {
	stats.requests++;
	next();
}

exports.status = function(req, res, next) {
	var ret = {
		requests: stats.requests,
		uptime: ((new Date).getTime() - stats.started) / 1000,
		secret: config.secret
	}
	res.json(ret);
	return next();
}

exports.debug = function(req, res, next) {
	Event.remove({}, function(err) {
		res.send("All events removed");
		return next();
	});
}
