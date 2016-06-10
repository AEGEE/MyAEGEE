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
exports.uploadImage = function(image) {
	var newimage = new Image(image);
	var retval = undefined;
	newimage.save(function(err) {
		if(err) return;
		retval = newimage.url;
	});
	return retval;
}

exports.removeImage = function(url) {
	// TODO implement
}