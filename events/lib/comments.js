// Could theoretically be split into a seperate server, doesn't interact with the rest of the module
// Idea: implement in elxir?
// Idea accepted =)
var mongoose = require('mongoose');
var log = require('./config/logger.js');
var restify = require('restify');
var helpers = require('./helpers.js');

var commentSchema = mongoose.Schema({
	event_id: {type: String, required: true, index: true},
	user: {
		foreign_id: {type: String, required: true},
		antenna_id: {type: String, required: true},
		antenna_name: String,
		name: String,
		profile_url: String
	},
	comment: String
}, {timestamps: true});
commentSchema.set('toJSON', {virtuals: true});
commentSchema.set('toObject', {virtuals: true});

var Comment = mongoose.model('Comment', commentSchema);

exports.listComments = function(req, res, next) {
	Comment
		.find({event_id: req.params.event_id})
		.exec(function(err, res) {
			if(err) {
				log.error("Could not retrieve comments", err);
				return next(new restify.InternalError());
			}
			res.json({
				success: 1,
				comments: res
			});
			return next();
		});
}

exports.createComment = function(req, res, next) {
	var data = req.body;

	// Fetch user-data
	helpers.getUserById(req.header('x-auth-token'), data.user.foreign_id, function(err, user) {
		if(err) {
			log.error("Could not fetch user", err);
			return next(new restify.InternalError());
		}

		data.user.antenna_id = user.antenna_id;
		data.user.antenna_name = user.antenna_name;
		data.user.name = user.first_name + ' ' + user.last_name;
		data.user.profile_url = user.seo;

		var comment = new Comment(data);
		comment.save(function(err) {
			res.json({
				success: true,
				message: "Comment saved successfully",
			});
			return next();
		});
	});
}