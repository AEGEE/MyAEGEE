/**
** This file provides basic functionalities not related to events
** Also responsible for communication with the core
*/

var config = require('./config/config.js');
var log = require('./config/logger.js');
var fs = require('fs');
var httprequest = require('request');
var mongoose = require('./config/mongo.js');
var restify = require('restify');
var cron = require('./cron.js');

/* Stat thing... remove!*/
var stats = {
  requests: 0,
  started: Date.now(),
};

exports.status = function (req, res, next) {
  require('./config/options.js').then(function (options) {
    var ret = {
      requests: stats.requests,
      uptime: ((new Date).getTime() - stats.started) / 1000,
      deadline_crons: cron.countJobs(),

      // For debugging purposes only, TODO remove!
      handshake_token: options.handshake_token,
    };
    res.json(ret);
    return next();
  });
};

// TODO remove, debug only
exports.getUser = (req, res, next) => {
  res.json(req.user);
  return next();
};

exports.countRequests = (req, res, next) => {
  stats.requests++;
  return next();
};

// Register the service with the core
exports.registerMicroservice = (req, res, next) => {
  require('./config/options.js').then((options) => {
    if (!options.enable_change) {
      return next(new restify.ForbiddenError('Registering Microservice is deactivated'));
    }

    var data = {
      name: 'OMS Events',
      code: 'oms-events',
      base_url: config.frontend.url,
      pages: JSON.stringify(config.frontend.pages),
    };

    // If wanted, overwrite the API-Key from a file
    var secret = config.secret;
    if (config.secret_overwrite) {
      secret = fs.readFileSync(config.secret_overwrite, 'utf8').trim();
      console.log(secret);
    }

    var opts = {
      url: config.core.url + ':' + config.core.port + '/api/registerMicroservice',
      method: 'POST',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'X-Api-Key': secret,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      form: data,
    };

    return httprequest(opts, (error, response, body) => {
      if (error) {
        log.error('Could not register microservice', error);
        return next(
          new restify.InternalError('Could not register microservice, core communication failed'));
      }

      log.info('some data received: ', body);

      try {
        body = JSON.parse(body);
      } catch (err) {
        log.error('Could not parse core response', err);
        return next(new restify.InternalError());
      }

      if (!body.success) {
        log.error('Could not register mircoservice, core replied with', body);
        return next(new restify.InternalError('Could not register microservice'));
      }

      options.handshake_token = body.handshake_token;
      options.enable_change = false;
      return options.save((err) => {
        if (err) {
          log.error('Could not save handshake token', err);
          return next(new restify.InternalError('Could not save handshake token'));
        }

        log.info('New handshake token registered: ' + body.handshake_token);

        res.json({
          success: true,
          message: 'New handshake token registered',
        });
        return next();
      });
    });
  });
};
