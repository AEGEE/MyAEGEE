var log = require('./logger.js');
var restify = require('restify');



exports.checkError = function(msg, err, next) {
	if(err) {
		log.error(msg, err);

		if(next)
			next(new restify.InternalError(msg));
	}
}

exports.checkFatal = function (msg, err, next) {
	if(err) {
		log.error("FATAL: " + msg, err);

		if(next)
			next(new restify.InternalError(msg));
		process.exit(1);
	}
}