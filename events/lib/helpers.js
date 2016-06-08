var log = require('./config/logger');

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
