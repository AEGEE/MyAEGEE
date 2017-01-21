const restify = require('restify');
const log = require('./logger.js');

exports.checkError = (msg, err, next) => {
  if (err) {
    log.error(msg, err);

    if (next) {
      next(new restify.InternalError(msg));
    }
  }
};

exports.checkFatal = (msg, err, next) => {
  if (err) {
    log.error(`FATAL: ${msg}`, err);

    if (next) {
      next(new restify.InternalError(msg));
    }
    process.exit(1);
  }
};
