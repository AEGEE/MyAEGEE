var mongoose = require('./mongo.js');
var log = require('./logger.js');
var Promise = require('promise');

var optionsSchema = mongoose.Schema({
	handshake_token: String,
	enable_change: {type: Boolean, default: true},
	roles: {
		su_admin: String,
		non_statutory_admin: String,
		statutory_admin: String,
		super_admin: String,
	}
})
optionsSchema.methods.getRequestHeaders = function(auth_token) {
	var retval = {
		'X-Requested-With': 'XMLHttpRequest',
		'X-Api-Key': this.handshake_token
	};

	if(auth_token) {
		retval['X-Auth-Token'] = auth_token;
	}
	return retval;
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