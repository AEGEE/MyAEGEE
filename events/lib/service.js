/**
** This file provides basic functionalities not related to events
** Also responsible for communication with the core
*/

var config = require('./config/config.json');
var log = require('./config/logger.js');

var httprequest = require('request');
var restify = require('restify');

/* Stat thing...*/
var stats = {
	requests: 0,
	started: Date.now()
}

exports.status = function(req, res, next) {
	require('./config/options.js').then(function(options) {
		var ret = {
			requests: stats.requests,
			uptime: ((new Date).getTime() - stats.started) / 1000,
			// For debugging purposes only, TODO remove!
			handshake_token: options.handshake_token
		}
		res.json(ret);
		return next();
	});
}

exports.countRequests = function(req, res, next) {
	stats.requests++;
	return next();
}

// Register the service with the core
exports.registerMicroservice = function(req, res, next) {
	var options = require('./config/options.js');

	var data = {
		'name': 'OMS Events',
		'code': 'oms-events',
		'base_url': config.frontend.url,
		'pages': JSON.stringify(config.frontend.pages),
	};

	var opts = {
		url: config.core.url + ':' + config.core.port + '/api/registerMicroservice',
		method: 'POST',
		headers: {
			'X-Requested-With': "XMLHttpRequest",
			'X-Api-Key': config.secret,
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

		body = JSON.parse(body);

		if(!body.success) {
			log.error("Could not register mircoservice, core replied with", body);
			return next(new restify.InternalError("Could not register microservice"));
		}


		options.then(function(options) {
			options.handshake_token = body.handshake_token;
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

/* For each request, query the core for user data */
exports.authenticateUser = function(req, res, next) {
	// Dummy authentication
	// TODO change for real authentication
	req.user = {
		foreign_id: "cave.johnson"
	}
	return next();
}


exports.fetchUserDetails = function(req, res, next) {
	// Dummy user-details fetch
	// TODO change for real user-details fetch
	req.user = {
		first_name: "Cave",
		last_name: "Johnson",
		foreign_id: "cave.johnson",
		home_local: {
			foreign_id: "AEGEE-Dresden"
		},
		bodies: [
			{
				name: "CD"
			}, {
				name: "EQAC"
			}, {
				name: "ITC"
			}
		],
	}
	return next();
}