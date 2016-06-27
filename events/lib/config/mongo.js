var config = require('./config.json');
var mongoose = require('mongoose');
var log = require('./logger');

// Connect to MongoDB
if(process.env.NODE_ENV == 'test')
	mongoose.connect(config.mongourl.test);
else
	mongoose.connect(config.mongourl.dev);
var db = mongoose.connection;
// Applying a fail-fast approach on mongodb connection loss
db.on('error', function(err) {
	log.info("Fatal error, exiting (%s)", err);
	console.log("Fatal mongodb error, exiting");
	process.exit(-1);
});

module.exports = mongoose;