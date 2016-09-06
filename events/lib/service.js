/**
** This file provides basic functionalities not related to events
** Also responsible for communication with the core
*/

var config = require('./config/config.js');
var log = require('./config/logger.js');

var httprequest = require('request');
var mongoose = require('./config/mongo.js');
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


		require('./config/options.js').then(function(options) {
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
// Cache user auth data so we don't have to query the core on each call
var userCacheSchema = mongoose.Schema({
	user: mongoose.Schema.Types.Mixed,
	createdAt: {type: Date, expires: 300, default: Date.now},
	token: {type: String, required: true, index: true}
})
var UserCache = mongoose.model('UserCache', userCacheSchema);

exports.authenticateUser = function(req, res, next) {
	var token = req.header('x-auth-token');
	if(!token) {
		log.info("Unauthenticated request", req);
		return next(new restify.ForbiddenError('No auth token provided'));
	}

	UserCache.findOne({token: token}, function(err, res) {
		// If not found, query core
		if(err || !res) {
			require('./config/options.js').then(options => {

				var opts = {
					url: config.core.url + ':' + config.core.port + '/api/getUserByToken',
					method: 'POST',
					headers: options.getRequestHeaders(),
					form: {
						'token': token
					},
				};

				httprequest(opts, function(err, res, body) {
					if(err) {
						log.error("Could not contact core to authenticate user", err);
						return next(new restify.InternalError)
					}

					try {
						body = JSON.parse(body);
					}
					catch(err) {
						log.error("Could not parse core response", err);
						return next(new restify.InternalError());
					}

					if(!body.success) {
						log.info("Access denied to user", body);
						return next(new restify.ForbiddenError('Access denied'));
					}

					if(!req.user)
						req.user = {};
					req.user.basic = body.user;
					next();

					// After calling next, try saving the fetched data to db
					var saveUserData = new UserCache();
					saveUserData.token = token;
					saveUserData.user = body.user;
					saveUserData.save(err => {
						if(err)
							log.error("Could not store user data in cache", err);
					});
				});
			});
		}
		// If found in cache, use that one
		else {
			if(!req.user)
				req.user = {}
			req.user.basic = res.user;
			return next();
		}
	});
	
}


exports.fetchUserDetails = function(req, res, next) {
	require('./config/options.js').then(options => {

		var token = req.header('x-auth-token');
		if(!token) {
			log.info("Unauthenticated request", req);
			return next(new restify.ForbiddenError('No auth token provided'));
		}

		var opts = {
			url: config.core.url + ':' + config.core.port + '/api/getUserProfile',
			method: 'GET',
			headers: options.getRequestHeaders(token),
			qs: {
				'is_ui': 0,
			},
		};

		httprequest(opts, function(err, res, body) {
			if(err) {
				log.error("Could not fetch user profile details from core", err);
				return next(new restify.InternalError)
			}

			try {
				body = JSON.parse(body);
			}
			catch(err) {
				log.error("Could not parse core response", err);
				return next(new restify.InternalError());
			}


			if(!body.success) {
				log.info("Core refused user profile fetch", body);
				return next(new restify.ForbiddenError('Core refused user profile fetch'));
			}

			if(!req.user)
				req.user = {};
			req.user.details = body.user;
			req.user.workingGroups = body.workingGroups;
			req.user.board_positions = body.board_positions;
			req.user.roles = body.roles;
			req.user.fees_paid = body.fees_paid;
			//log.info(req.user);

			return next();
		});
	});
}