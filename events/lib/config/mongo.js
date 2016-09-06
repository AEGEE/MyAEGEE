var config = require('./config.js');
var mongoose = require('mongoose');
var log = require('./logger');


mongoose.connect(config.mongourl);
var db = mongoose.connection;
// Applying a fail-fast approach on mongodb connection loss
db.on('error', function(err) {
	log.info("Fatal error, exiting (%s)", err);
	console.log("Fatal mongodb error, exiting");
	process.exit(-1);
});

module.exports = mongoose;