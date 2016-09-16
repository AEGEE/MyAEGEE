var config = require('./config/config.js');
var log = require('./config/logger.js');
var restify = require('restify');
var helpers = require('./helpers.js');
var mongoose = require('./config/mongo.js');
var imageserv = require('./imageserv.js');
var cron = require('./cron.js');


var Event = require('./eventModel.js');


/** Requests for all events **/

exports.listEvents = function(req, res, next) {
	Event
		.where('status', 'approved')
		.where('ends').gte(new Date()) // Only show events in the future
		.select(['id', 'name', 'starts', 'ends', 'description', 'type', 'status', 'max_participants', 'application_status'].join(' '))
		//.sort('starts') // done on client side
		.exec(function(err, events) {
		
		if (err) {log.info(err);return next(new restify.InternalError());}
		
		res.json(events);
		return next();
	});
}

// Returns all events the user is organizer on
exports.listUserOrganizedEvents = function(req, res, next) {
	Event
		.where('status').ne('deleted') // Hide deleted events
		.where('ends').gte(new Date()) // Only show events in the future
		.elemMatch('organizers', {'foreign_id': req.user.basic.id})
		.select(['name', 'starts', 'ends', 'description', 'type', 'status', 'max_participants', 'application_status'].join(' '))
		.exec(function(err, events) {
			if (err) {log.info(err);return next(new restify.InternalError());}
		
			res.json(events);
			return next();
		});
}


exports.listUserAppliedEvents = function(req, res, next) {
	Event
		.where('status').ne('deleted') // Hide deleted events
		.where('ends').gte(new Date()) // Only show events in the future
		.elemMatch('applications', {'foreign_id': req.user.basic.id})
		.select(['name', 'starts', 'ends', 'description', 'type', 'status', 'max_participants', 'application_status'].join(' '))
		.exec(function(err, events) {
			if (err) {log.info(err);return next(new restify.InternalError());}
		
			res.json(events);
			return next();
		});
}

exports.listApprovableEvents = function(req, res, next) {
	Event
		.where('status', 'requesting')
		.where('ends').gte(new Date())
		.select(['name', 'type', 'max_participants', 'application_status'].join(' '))
		.exec(function(err, events) {
			var retval = [];
			events.forEach(item => {
				if(req.user.permissions.is.superadmin)
					retval.push(item);
				else if(req.user.permissions.is.su_admin && item.type == 'su')
					retval.push(item);
				else if(req.user.permissions.is.statutory_admin && item.type == 'statutory')
					retval.push(item);
				else if(req.user.permissions.is.non_statutory_admin && item.type == 'non-statutory')
					retval.push(item);
				else if(item.type == 'local' && req.user.board_positions.length > 0
					&& item.organizing_locals.some(i => i.foreign_id == req.user.basic.antenna_id))
					retval.push(item);
			});

			res.json(retval);
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
	

	var newevent = new Event(data);
	
	// Creating user automatically becomes organizer
	newevent.organizers = [
		{
			first_name: req.user.basic.first_name,
			last_name: req.user.basic.last_name,
			foreign_id: req.user.basic.id,
			role: 'full',
		}
	];

	// Creating user's local automatically becomes organizing local
	newevent.organizing_locals = [
		{
			name: req.user.details.antenna_city,
			foreign_id: req.user.basic.antenna_id,
		}
	]


	// Validate
	error = newevent.validateSync();
	if(error != null) {
		return next(new restify.InvalidArgumentError({body: error}));
	}

	newevent.save(function(err) {
		if(err) {
			log.info(err);
			return next(err);
		}
		delete newevent.applications;

		// Register cronjob for deadline
		if(data.application_deadline)
			cron.registerDeadline(newevent.id, newevent.application_deadline);

		res.status(201);
		res.json(newevent);
		return next();
	});
}

/** Single event **/



exports.eventDetails = function(req, res, next) {
	
	var event = req.event.toObject();
	
	delete event.applications;
	delete event.organizers;
	
	
	res.json(event);
	return next();

}

exports.editEvent = function(req, res, next) {
	// If user can't edit anything, return error right away
	if(!req.user.permissions.can.edit) {
		return next(new restify.ForbiddenError('You cannot edit this event'));
	}

	var data = req.body;
	var event = req.event;
	var registerDeadline = false;
	// Disallow changing applications and organizers, use seperate requests for that
	delete data.applications;
	delete data.organizers;
	delete data.organizing_locals;
	delete data.status;

	if(Object.keys(data).length == 0) {
		return next(new restify.InvalidContentError({message: 'No valid field changes requested'}));
	}

	// Copy fields if user can edit details
	if (req.user.permissions.can.edit_details) {
		if(data.name) event.name = data.name;
		if(data.starts) event.starts = data.starts;
		if(data.ends) event.ends = data.ends;
		if(data.description) event.description = data.description;
		if(data.type) event.type = data.type;
		if(data.max_participants) event.max_participants = data.max_participants;
		if(data.application_fields) event.application_fields = data.application_fields;
		if(data.application_deadline) {
			event.application_deadline = data.application_deadline;
			registerDeadline = true;
		}

	}

	// Change application status
	if(req.user.permissions.can.edit_application_status) {
		event.application_status = data.application_status;
		event.application_deadline = data.application_deadline;
	}

	// Try to save
	event.save(function(err) {
		if (err) {
			// Send validation-errors back to client
			if(err.name == 'ValidationError') {
				return next(new restify.InvalidArgumentError({body: err}));
			}

			log.error(err);
			return next(new restify.InternalError());
		}
		
		var retval = event.toObject();
		delete retval.applications;
		delete retval.organizers;
		delete retval.__v;
		delete retval.headImg;

		// If deadline was registered, pass that to cron
		if(registerDeadline)
			cron.registerDeadline(event.id, event.application_deadline);
		
		res.json(retval);
		return next();
	});
	
}

exports.deleteEvent = function(req, res, next) {
	// TODO Check for user privilegies
	var event = req.event;

	// Deletion is only changing status to deleted
	event.status = 'deleted';
	event.save(function(err) {
		if (err) {log.info(err);return next(new restify.InternalError());}

		res.send("Event successfully deleted");
		return next();
	});
}

exports.setApprovalStatus = function(req, res, next) {
	// Normal edit rights are enough to request approval
	// Otherwise approval permission needed
	if(req.user.permissions.can.approve ||
	   (req.user.permissions.can.edit_details && 
	   		(req.event.status == 'draft' && req.body.status == 'requesting') ||
	   		(req.event.status == 'requesting' && req.body.status == 'draft'))) {
		req.event.status = req.body.status;

		// Validate
		error = event.validateSync();
		if(error != null) {
			return next(new restify.InvalidArgumentError({body: error}));
		}

		req.event.save(function(err) {
			if(err) {
				log.error("Could not save event status");
				return next(new restify.InternalError());
			}
			res.json({
				success: true,
				message: "Successfully changed approval status"
			});
			return next();
		});
	}

}

// Just forward the edit rights generated by checkUserRole
exports.getEditRights = function(req, res, next) {
	var retval = req.user.permissions;

	res.json(retval);
	return next();
}

/** Participants **/
exports.listParticipants = function(req, res, next) {
	// TODO Check for user privilegies
	// Idea: Only let people see applications after application period ended
	
	var event = req.event;
		
	var applications = event.applications.toObject();
	
	applications.forEach(function(x, idx) {
		applications[idx].url = event.url + '/participants/' + applications[idx].foreign_id;
	});
	
	res.json(applications);
	return next();
}


exports.getApplication = function(req, res, next) {
	var event = req.event;
		
	// Search for the application
	var application = event.applications.find(function(element) {return element.foreign_id == req.user.basic.id;});
	if (application == undefined)
		return next(new restify.ResourceNotFoundError("User " + req.user.basic.id + " not found"));
	
	res.json(application);
	return next();
	
}

exports.setApplication = function(req, res, next) {
	var event = req.event;
	
	// Check for permission
	if(!req.user.permissions.can_apply)
		return next(new restify.ForbiddenError({message: "You cannot apply to this event"}));
	
	// Find the corresponding application
	var index;
	var application = event.applications.find(function(element, idx) {
		if(element.foreign_id == req.user.basic.id) {
			index = idx;
			return true;
		}
		return false;
	});

	// If user hasn't applied yet, create an application
	if (application == undefined) {
		event.applications.push({
			foreign_id: req.user.basic.id,
			first_name: req.user.basic.first_name,
			last_name: req.user.basic.last_name,
			antenna: req.user.details.antenna_name,
			antenna_id: req.user.basic.antenna_id,
			application: req.body.application
		});
		index = event.applications.length - 1;
	}
	else
		event.applications[index].application = req.body.application;
		
	
	// Only check the current application for validity, as checking all of them would be too much overhead on big events
	var tmp = helpers.checkApplicationValidity(event.applications[index].application, event.application_fields);
	if (!tmp.passed)
		return next(new restify.InvalidContentError('Application malformed: ' + tmp.msg));
	
	
	// Validate
	error = event.validateSync();
	if(error != null) {
		return next(new restify.InvalidArgumentError({body: error}));
	}

	event.save(function(err) {
		if (err) {log.info(err);return next(new restify.InternalError());}
		
		res.json(event.applications[index]);
		return next();
	});
}

exports.setApplicationStatus = function(req, res, next) {
	// Check user permissions
	if(!req.user.permissions.can.approve_participants) {
		return next(new restify.ForbiddenError('You are not allowed to accept or reject participants'));
	}

	var event = req.event;

	// Find the corresponding application
	var index;
	var application = event.applications.find(function(element, idx) {
		if(element.id == req.params.application_id) {
			index = idx;
			return true;
		}
		return false;
	});

	if(application == undefined) {
		return next(new restify.NotFoundError('Could not find application id ' + req.params.application_id));
	}

	// Save changes
	event.applications[index].application_status = req.body.application_status;
	error = event.validateSync();
	if(error != null) {
		return next(new restify.InvalidArgumentError({body: error}));
	}

	event.save(function(err) {
		if (err) {log.info(err);return next(new restify.InternalError());}
		res.status(200);
		res.json({message: 'Application successfully updated'});
		return next();
	});
}

/** Organizers **/

exports.listOrganizers = function(req, res, next) {
	// TODO Check for permissions
	var event = req.event;
		
	var data = event.organizers.toObject();
	data.forEach(function(x, idx) {
		data[idx].url = event.url + '/organizers/' + x.foreign_id;
	});
	
	res.json(data);
	return next();
}

exports.setOrganizers = function(req, res, next) {
	var event = req.event;

	var data = req.body.organizers;
	if(data.constructor !== Array)
		return next(new restify.InvalidArgumentError('Organizers list must be an array'));
	if(data.length == 0) 
		return next(new restify.InvalidArgumentError('Organizers list can not be empty'));
	

	data.forEach(function(x, idx){
		delete data[idx].cache_first_name;
		delete data[idx].cache_last_name;
		delete data[idx].cache_update;

	});

	event.organizers = data;
	error = event.validateSync();
	if(error != null) {
		return next(new restify.InvalidArgumentError({body: error}));
	}

	event.save(function(err) {
		if (err) {log.info(err);return next(new restify.InternalError());}
		res.status(200);
		res.json({organizers: event.organizers});
		return next();
	});
}

// TODO remove
exports.debug = function(req, res, next) {
	Event.remove({}, function(err) {
		res.send("All events removed, can not be undone. Muhahaha. Wouldn't have guessed this is this serious, wouldn't you?");
		return next();
	});
}

