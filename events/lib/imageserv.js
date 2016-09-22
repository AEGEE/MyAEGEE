var mongoose = require('./config/mongo');
var restify = require('restify');
var log = require('./config/logger');
var config = require('./config/config.js');
var Event = require('./eventModel.js');
var multer  = require('multer');
var fs = require('fs');

var storage = multer.diskStorage({ //multers disk storage settings
	destination: function (req, file, cb) {
		cb(null, config.media_dir + '/headimages');
	},
	filename: function (req, file, cb) {
		cb(null, req.event.id + '-' + (new Date()).getTime());
	}
});
var upload = multer({storage: storage}).single('head_image');

exports.uploadImage = function(req, res, next) {
	upload(req, res, function(err) {
		if(err) {
			log.error("Could not store image", err);
			return next(new restify.InternalError());
		}
		// If there was an old image, move that away later
		var oldimg = req.event.head_image;

		req.event.head_image = {
			path: req.file.path
		}

		req.event.save(function(err) {
			if(err) {
				log.error("Could not store image metadata to db", err);
				return next(new restify.InternalError());
			}

			res.json({
				success: true,
				message: "File uploaded successfully",
				head_image: req.event.head_image
			});
			// Send back the request
			next();

			// Move old file away
			if(oldimg && oldimg.path) {
				var path = oldimg.path.split('/');
				fs.rename(oldimg.path, config.media_dir + '/old/' + path[path.length-1], function(err) {
					if(err) {
						log.warn("Could not move unused image into media/old folder", err);
					}
				});
			}
		});
	});
}
