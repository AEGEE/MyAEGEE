const config = require('./config.js');
const mongoose = require('mongoose');
const log = require('./logger');

mongoose.Promise = global.Promise;
mongoose.connect(config.mongourl, { useMongoClient: true });

const db = mongoose.connection;

// Applying a fail-fast approach on mongodb connection loss
db.on('error', (err) => {
  log.info('Fatal error, exiting (%s)', err);
  process.exit(-1);
});

module.exports = mongoose;
