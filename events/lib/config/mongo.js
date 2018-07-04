const mongoose = require('mongoose');

const config = require('./config.js');
const log = require('./logger');


mongoose.Promise = global.Promise;
mongoose.connect(config.mongourl);

const db = mongoose.connection;

// Applying a fail-fast approach on mongodb connection loss
db.on('error', (err) => {
  log.error ('Fatal database error, exiting %s', err);
  process.exit(1);
});

db.once('open', () => {
  log.info('Connected to MongoDB at %s', config.mongourl);
});

module.exports = mongoose;
