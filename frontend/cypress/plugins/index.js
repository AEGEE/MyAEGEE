module.exports = (on, config) => {
  // eslint-disable-next-line global-require
  require('@cypress/code-coverage/task')(on, config)
  // IMPORTANT to return the config object
  // with the any changed environment variables
  return config
}
