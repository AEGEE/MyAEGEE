const request = require('request-promise-native');

const config = require('./config/config');

const namecache = {};

module.exports.getServiceByName = async (name) => {
  // If we already fetched that name, just return it as it is not going to change quickly
  if (namecache[name]) {
    return namecache[name];
  }

  let body;

  // Right after startup we will have to query the registry for the data
  try {
    body = await request({
      url: `${config.registry.url}:${config.registry.port}/services/${name}`,
      json: true,
    });
  } catch (err) {
    throw new Error(`Error getting info about core from service registry, response: ${err.message}`);
  }

  try {
    if (!body.success) {
      throw new Error(`Error when looking up service, registry replied: ${body.message}`);
    }

    namecache[name] = body.data;
    return body.data;
  } catch (err) {
    throw err;
  }
};

module.exports.getRequestHeaders = async (req) => {
  // If we have the X-Auth-Token header, just use it.
  if (req && req.headers && req.headers['x-auth-token']) {
    return {
      'X-Requested-With': 'XMLHttpRequest',
      'X-Auth-Token': req.headers['x-auth-token'],
    };
  }

  throw new Error('No X-Auth-Token header provided.');
};
