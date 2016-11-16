/**
** This file provides basic functionalities not related to events
** Also responsible for communication with the core
*/

var config = require('./config/config.js');
var log = require('./config/logger.js');
var fs = require('fs');
var httprequest = require('request');
var mongoose = require('./config/mongo.js');
var restify = require('restify');
var cron = require('./cron.js');

/* Stat thing... remove!*/
var stats = {
	requests: 0,
	started: Date.now()
}

exports.status = function(req, res, next) {
	require('./config/options.js').then(function(options) {
		var ret = {
			requests: stats.requests,
			uptime: ((new Date).getTime() - stats.started) / 1000,
			deadline_crons: cron.countJobs(),
			// For debugging purposes only, TODO remove!
			handshake_token: options.handshake_token
		}
		res.json(ret);
		return next();
	});
}

// TODO remove, debug only
exports.getUser = function(req, res, next) {
	res.json(req.user);
	return next();
}

exports.countRequests = function(req, res, next) {
	stats.requests++;
	return next();
}

// Register the service with the core
exports.registerMicroservice = function(req, res, next) {

	require('./config/options.js').then(function(options) {
		if(!options.enable_change)
			return next(new resfity.ForbiddenError("Registering Microservice is deactivated"));

		var data = {
			'name': 'OMS Events',
			'code': 'oms-events',
			'base_url': config.frontend.url,
			'pages': JSON.stringify(config.frontend.pages),
		};

		// If wanted, overwrite the API-Key from a file
		var secret = config.secret;
		if(config.secret_overwrite) {
			secret = fs.readFileSync(config.secret_overwrite).trim();
		}

		var opts = {
			url: config.core.url + ':' + config.core.port + '/api/registerMicroservice',
			method: 'POST',
			headers: {
				'X-Requested-With': "XMLHttpRequest",
				'X-Api-Key': secret,
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			form: data,
		};

		
		httprequest(opts, function(error, response, body) {
			if(error) {
				log.error("Could not register microservice", error);
				return next(new restify.InternalError("Could not register microservice, core communication failed"));
			}
			log.info("some data received: ", body);

			try {
				body = JSON.parse(body);
			}
			catch(err) {
				log.error("Could not parse core response", err);
				return next(new restify.InternalError());
			}

			if(!body.success) {
				log.error("Could not register mircoservice, core replied with", body);
				return next(new restify.InternalError("Could not register microservice"));
			}

			options.handshake_token = body.handshake_token;
			options.enable_change = false;
			options.save(function(err) {
				if(err) {
					log.error("Could not save handshake token", err);
					return next(new restify.InternalError("Could not save handshake token"));
				}

				log.info("New handshake token registered: " + body.handshake_token);

				res.json({
					'success': true,
					'message': 'New handshake token registered'
				});
				return next();
			});
		});
	});
}

// List the current roles
exports.getRoles = function(req, res, next) {
	require('./config/options.js').then(function(options) {
		res.json(options.roles);
		return next();
	});
}

// Register which role acts as an admin for which kind of events
exports.registerRoles = function(req, res, next) {
	if(!req.user.basic.is_superadmin)
		return next(new restify.ForbiddenError({message: "Need to be superadmin"}));

	require('./config/options.js').then(function(options) {
		options.roles = req.body.roles;
		options.save(function(err) {
			if(err) {
				log.error("Could not save new roles", err);
				return next(new restify.InternalError("Could not save new roles"));
			}
			res.json({
				success: true,
				message: "New roles saved"
			});
		});
	});
}
