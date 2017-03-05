const mongoose = require('../config/mongo.js');

const optionsSchema = mongoose.Schema({
  handshake_token: String,
  enable_change: { type: Boolean, default: true },
});

optionsSchema.methods.getRequestHeaders = function getRequestHeaders(authToken) {
  const retval = {
    'X-Requested-With': 'XMLHttpRequest',
    'X-Api-Key': this.handshake_token,
  };

  if (authToken) {
    retval['X-Auth-Token'] = authToken;
  }
  return retval;
};

module.exports = mongoose.model('Option', optionsSchema);
