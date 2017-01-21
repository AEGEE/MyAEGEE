const Promise = require('promise');
const log = require('./logger.js');

const Options = require('../models/Options');

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
