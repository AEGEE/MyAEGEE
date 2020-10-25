'use strict';
const config = require('../config/configFile.js');
const serverInfo = require('./info.js');

module.exports = {
  info: {
    // API informations (required)
    title: serverInfo.name(), // Title (required)
    version: serverInfo.version(), // Version (required)
    description: 'API that wrap functionality of G Suite', // Description (optional)
    termsOfService: "https://my.aegee.eu/legal/simple",
    contact: {
      email: "myaegee@aegee.eu"
    },
    license: {
      name: "Apache 2.0",
      url: "http://www.apache.org/licenses/LICENSE-2.0.html"
    }
  },
  // host, // Host (optional) -- automatically taken who's serving this docs
  apis: ['lib/gsuite-wrapper.js'], // where are the files with the comments
  basePath: config.basePath, // Base path (optional)
  schemes: ['http'],
  externalDocs: {
    description: "Find out more about MyAEGEE",
    url: "https://myaegee.atlassian.net/wiki/spaces/GENERAL/overview"
  }
};
