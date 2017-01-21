const Promise = require('promise');
const mongoose = require('./mongo.js');
const log = require('./logger.js');

// TODO: Move this into separate file and folder.
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

const Options = mongoose.model('Option', optionsSchema);
let fetchedOptions = null;

module.exports = new Promise((resolve, reject) => {
  if (fetchedOptions != null) {
    resolve(fetchedOptions);
  }

  Options.findOne().exec((err, res) => {
    if (err) {
      log.error('Could not fetch options from db', err);
      reject(err);
    }
    if (res == null) {
      // No option yet created - create one!
      // TODO: Figure out how this works and refactor it.
      fetchedOptions = new Options();
      fetchedOptions.save((saveErr) => {
        if (saveErr) {
          log.error('Could not create options document in db', saveErr);
          reject(saveErr);
        }
      });
      resolve(fetchedOptions);
    } else {
      fetchedOptions = res;
      resolve(fetchedOptions);
    }
  });
});
