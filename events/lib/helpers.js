var log = require('./config/logger');
var httprequest = require('request');
var config = require('./config/config.js');


exports.checkApplicationValidity = function(application, application_fields) {
	// Check if every field in the application array resembles to a field in event.application_fields
	if (application == undefined || Object.prototype.toString.call( application ) !== '[object Array]')
		return {passed: false, msg: 'Not an array'};
	if (application.length > application_fields.length)
		return {passed: false, msg: 'Application too long'};
	
	
	
	// O(N*N), let's hope applications don't get big
	var error = false;
	application.forEach(function(userField) {
		if(application_fields.find(function(applicationField) {
			return (applicationField._id == userField.field_id);
		}) == undefined )
			error = true;
	});
	if(error)
		return {passed: false, msg: 'Invalid field_id'};

	// TODO Check for duplicate fields

	return {passed: true, msg: ''};
}


exports.getUserById = function(authToken, id, callback) {
	require('./config/options.js').then(options => {
		var opts = {
			url: config.core.url + ':' + config.core.port + '/api/getUser',
			method: 'GET',
			headers: options.getRequestHeaders(authToken),
			qs: {
				'id': id,
			},
		};

		httprequest(opts, function(err, res, body) {
			if(err) {
				//log.error("Could not contact core", err);
				return callback(err, null);
			}

			try {
				body = JSON.parse(body);
			}
			catch(err) {
				//log.error("Could not parse core response", err);
				return callback(err, null);
			}

			if(!body.success) {
				//log.info("Access denied to user", body);
				return callback(null, null);
			}

			// TODO dirty hack
			body.user.antenna_name = 'AEGEE-' + body.user.antenna.city;

			return callback(null, {basic: body.user});
		});
	});
}