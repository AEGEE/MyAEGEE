'use strict';
const config = require('../config/configFile.js');
module.exports = {
  info: {
    // API informations (required)
    title: 'Autofloor', // Title (required)
    version: '1.0', // Version (required)
    description: 'API that integrates the autofloor script gonzalo. Writes and gets stuff from the DBs such that gonzalo doesn\'t have to', // Description (optional)
  },
  // host, // Host (optional) -- automatically taken who's serving this docs
  apis: ['lib/controller.js'], // where are the files with the comments
  basePath: config.basePath, // Base path (optional)
  schemes: ['http'],
};
