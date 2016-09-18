// Could theoretically be split into a seperate server, doesn't interact with the rest of the module
var mongoose = require('mongoose');
var log = require('./config/logger.js');
var restify = require('restify');

var commentSchema = mongoose.Schema({
	event_id: {type: String, required: true, index: true},
	user: {
		foreign_id: {type: String, required: true},
		antenna_id: {type: String, required: true},
		antenna_name: String,
		name: String,
		seo: String
	},
	comment: String
}, {timestamps: true});
commentSchema.set('toJSON', {virtuals: true});
commentSchema.set('toObject', {virtuals: true});

var Comment = mongoose.model('Comment', commentSchema);

// Simple CRUD for the comments
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

}