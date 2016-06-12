var mongoose = require('./config/mongo');
var restify = require('restify');
var log = require('./config/logger');

var imageSchema = mongoose.Schema({
	data: {type: Buffer, required: true},
	contentType: {type: String, required: true},
});
imageSchema.virtual('url').get(function() {return '/image/' + this._id;});

var Image = mongoose.model('Image', imageSchema);

exports.getImage = function(req, res, next) {
	Image.findById(req.params.image_id, function(err, image) {
		if (err) {log.info(err);return next(new restify.NotFoundError());}

		res.contentType = image.contentType;
		res.send(image.data);
	});
}

// Takes an image, saves it to the db and returns the URL
// Pass a function that take an err and the resulting url
exports.uploadImage = function(image, callback) {
	var newimage = new Image(image);
	newimage.save(function(err) {
		callback(err, newimage.url);
	});
}

exports.removeImage = function(url) {
	// TODO implement
}