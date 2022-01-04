const os = require('os');

// Assuming by default that we run in 'development' environment, if no
// NODE_ENV is specified.
exports.env = process.env.NODE_ENV || 'development';
exports.host = process.env.X_HOST || os.hostname();
exports.name = process.env.npm_package_name;
exports.version = process.env.npm_package_version;
exports.description = process.env.npm_package_description;
