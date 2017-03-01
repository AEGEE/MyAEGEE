const mongoose = require('mongoose');


var eventRoleSchema = mongoose.Schema({
	cfg_id: String,
	name: String,
	description: String
});

module.exports = mongoose.model('EventRole', eventRoleSchema);
