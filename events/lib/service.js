/**
** This file provides basic functionalities not related to events
** Also responsible for communication with the core
*/

const config = require('./config/config.js');
const log = require('./config/logger.js');
const fs = require('fs');
const httprequest = require('request');
const restify = require('restify');
const cron = require('./cron.js');
const eventroles = require('./config/eventroles');

/* Stat thing... remove!*/
const stats = {
  requests: 0,
  started: Date.now(),
};

exports.status = (req, res, next) => {
  require('./config/options.js').then((options) => {
    const ret = {
      requests: stats.requests,
      uptime: ((new Date()).getTime() - stats.started) / 1000,
      deadline_crons: cron.countJobs(),

      // For debugging purposes only, TODO remove!
      handshake_token: options.handshake_token,
    };

    res.json({
      success: true,
      data: [ret],
    });
    return next();
  });
};

// TODO remove, debug only
exports.getUser = (req, res, next) => {
  res.json({
    success: true,
    data: [req.user],
  });
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
      return next(new restify.ForbiddenError({
        body: {
          success: false,
          message: 'Registering Microservice is deactivated',
        },
      }));
    }

    const data = {
      name: 'OMS Events',
      code: 'oms-events',
      base_url: config.frontend.url,
      pages: JSON.stringify(config.frontend.pages),
    };

    // If wanted, overwrite the API-Key from a file
    const callback = function (secret) {
      const opts = {
        url: `${config.core.url}:${config.core.port}/api/registerMicroservice`,
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'X-Api-Key': secret,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        form: data,
      };

      log.info('Registering ms');

      return httprequest(opts, (requestErr, requestRes, requestBody) => {
        if (requestErr) {
          log.error('Could not register microservice', requestErr);
          return next(new restify.InternalError({
            body: {
              success: false,
              message: 'Could not register microservice, core communication failed',
            },
          }));
        }

        log.info('some data received: ', requestBody);

        let body;
        try {
          body = JSON.parse(requestBody);
        } catch (err) {
          log.error('Could not parse core response', err);
          return next(new restify.InternalError({
            body: {
              success: false,
              message: `Could not parse core response: ${err.message}`,
            },
          }));
        }

        if (!body.success) {
          log.error('Could not register mircoservice, core replied with', body);
          return next(new restify.InternalError({
            body: {
              success: false,
              message: `Could not register microservice: core response: ${JSON.stringify(body, null, ' ')}`,
            },
          }));
        }

        options.handshake_token = body.handshake_token;
        options.enable_change = false;

        return options.save((err) => {
          if (err) {
            log.error('Could not save handshake token', err);
            return next(new restify.InternalError({
              body: {
                success: false,
                message: 'Could not save handshake token',
              },
            }));
          }

          log.info(`New handshake token registered: ${body.handshake_token}`);

          res.json({
            success: true,
            message: 'New handshake token registered',
          });
          return next();
        });
      });
    };


    if (config.secret_overwrite) {
      fs.readFile(config.secret_overwrite, 'utf8', (err, secret) => {
        if (err) {
          log.error('Could not read API-Key', err);
          return next(new restify.InternalError('Could not read API-Key'));
        }
        secret = secret.trim();
        log.info(`Read API-Key from file: ${secret}`);
        return callback(secret);
      });
    } else {
      return callback(config.secret);
    }
  });
};
