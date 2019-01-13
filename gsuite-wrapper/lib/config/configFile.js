'use strict'

process.env["NODE_CONFIG_DIR"] = __dirname;
const config = require('config');

config.GsuiteKeys = require('./myaegee-service.keys.json');
config.GsuiteKeys.delegatedUser = require('./secrets.json').gsuiteUser;

module.exports = config ;
//module.exports = exports = config ;
