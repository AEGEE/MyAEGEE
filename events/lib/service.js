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
  const ret = {
    requests: stats.requests,
    uptime: ((new Date()).getTime() - stats.started) / 1000,
    deadline_crons: cron.countJobs()
  };

  res.json({
    success: true,
    data: [ret],
  });
  return next();
};

// TODO remove, debug only
exports.getUser = (req, res, next) => {
  res.json({
    success: true,
    data: req.user,
  });
  return next();
};

exports.countRequests = (req, res, next) => {
  stats.requests++;
  return next();
};
