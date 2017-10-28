const request = require('request-promise-native');
const fs = require('fs');

const config = require('./config/config');

const namecache = {};
let authtoken = {};

const readFileWrapper = (file, enc = 'utf-8') => new Promise((res, rej) => {
  fs.readFile(file, enc, (err, data) => {
    if (err) {
      return rej(err);
    }

    return res(data);
  });
});

module.exports.getServiceByName = async (name) => {
  // If we already fetched that name, just return it as it is not going to change quickly
  if (namecache.hasOwnProperty(name)) {
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

const getAuthToken = async () => {
  // If we already have a valid token, just return it
  if (authtoken.instance_key && (new Date(authtoken.expires)) > (new Date())) {
    return authtoken.instance_key;
  }


  // Otherwise we need to get one from the registry
  try {
    const data = await readFileWrapper(config.registry_api_key, 'utf8');
    const body = await request({
      url: `${config.registry.url}:${config.registry.port}/gettoken`,
      method: 'POST',
      json: true,
      body: {
        api_key: data,
        name: config.servicename,
      },
    });

    if (!body.success) {
      return Promise.reject(new Error(`Error when getting access token, registry replied: ${body.message}`));
    }

    authtoken = body.data;
    return authtoken.data;
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

  // Otherwise, fetch it from oms-serviceregistry.
  const token = await getAuthToken();
  return {
    'X-Requested-With': 'XMLHttpRequest',
    'X-Api-Key': token.x_api_key,
  };
};

module.exports.getAuthToken = getAuthToken;
