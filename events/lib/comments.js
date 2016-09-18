var mongoose = require('mongoose');

var commentSchema = mongoose.Schema({
	event_id: {type: String, required: true, index: true},
	user: {
		foreign_id: {type: String, required: true},
		antenna_id: {type: String, required: true},
		antenna_name: String,
		name: String
	},
	comment: String,
	likes: Number,
}, {timestamps: true});
commentSchema.set('toJSON', {virtuals: true});
commentSchema.set('toObject', {virtuals: true});

var Comment = mongoose.model('Comment', commentSchema);