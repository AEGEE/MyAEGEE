const config = require('../config/configFile');
const serverInfo = require('./info');

module.exports = {
    info: {
    // API informations (required)
        title: serverInfo.name, // Title (required)
        version: serverInfo.version, // Version (required)
        description: serverInfo.description, // Description (optional)
        termsOfService: 'https://my.aegee.eu/legal/simple',
        license: {
            name: 'Apache 2.0',
            url: 'http://www.apache.org/licenses/LICENSE-2.0.html',
        },
    },
    // host, // Host (optional) -- automatically taken who's serving this docs
    apis: ['lib/gsuite-wrapper.js'], // where are the files with the comments
    basePath: config.basePath, // Base path (optional)
    schemes: ['http'],
    externalDocs: {
        description: 'Find out more about MyAEGEE',
        url: 'https://myaegee.atlassian.net/wiki/spaces/GENERAL/overview',
    },
};
