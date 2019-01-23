const os = require('os');

const host = () => {
  return process.env.X_HOST || os.hostname();
}

const name = () => {
  return process.env.npm_package_name;
}

const version = () => {
  return process.env.npm_package_version;
}

// Assuming by default that we run in 'development' environment, if no
// NODE_ENV is specified.
const env = process.env.NODE_ENV || 'development';

exports.host = host;
exports.name = name;
exports.version = version;
exports.env = env;
