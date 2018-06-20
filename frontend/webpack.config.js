const env = process.env.NODE_ENV || 'development'

const mapConfigs = {
  development: './build/webpack.dev.conf.js',
  production: './build/webpack.prod.conf.js'
}

module.exports = require(mapConfigs[env]);
