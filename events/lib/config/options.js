var mongoose = require('./mongo.js');
var log = require('./logger.js');
var Promise = require('promise');

var optionsSchema = mongoose.Schema({
	handshake_token: String,
})
optionsSchema.methods.getRequestHeaders = function() {
	return {
		'X-Requested-With': 'XMLHttpRequest',
		'X-Api-Key': this.handshake_token
	};
}

var Options = mongoose.model('Option', optionsSchema);

var fetchedOptions = null;

module.exports = new Promise(function(resolve, reject) {
	if(fetchedOptions != null)
		resolve(fetchedOptions);

	Options.findOne().exec(function(err, res) {
		if (err) {
			log.error("Could not fetch options from db", err);
			reject(err);
		}
		if(res == null) {
			// No option yet created - create one!
			fetchedOptions = new Options();
			fetchedOptions.save(function(err) {
				if (err) {
					log.error("Could not create options document in db", err);
					reject(err);
				}
			});
			resolve(fetchedOptions);
		}
		else {
			fetchedOptions = res;
			resolve(fetchedOptions);
		}
	});
});