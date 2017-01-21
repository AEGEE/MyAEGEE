const config = require('./configFile.json');

const exp = config.dev;
if (process.env.NODE_ENV === 'test') {
  for (const attr in config.test) {
    exp[attr] = config.test[attr];
  }
}

module.exports = exp;
