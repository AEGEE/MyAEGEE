const config = require('./configFile.json');

// Assuming by default that we run in 'development' environment, if no
// NODE_ENV is specified.
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

// Can't run without config.
if (!config[process.env.NODE_ENV]) {
  throw new Error(`No config for current environment: ${process.env.NODE_ENV}`);
}

// Using config for the current environment.
const envConfig = config[process.env.NODE_ENV];

// If the server is running in the test env, we just copy not filled in fields
// from the 'development' env.
// TODO: think about it.
if (process.env.NODE_ENV === 'test') {
  for (const attr in config.development) {
    if (!envConfig[attr]) {
      envConfig[attr] = config.development[attr];
    }
  }
}

module.exports = envConfig;
