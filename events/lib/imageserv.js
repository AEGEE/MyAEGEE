const restify = require('restify');
const fs = require('fs-extra');
const multer = require('multer');
const log = require('./config/logger');
const config = require('./config/config.js');

const uploadFolderName = `${config.media_dir}/headimages`;

const storage = multer.diskStorage({ // multers disk storage settings
  destination(req, file, cb) {
    cb(null, uploadFolderName);
  },

  filename(req, file, cb) {
    cb(null, `${req.event.id}-${(new Date()).getTime()}`);
  },
});
const upload = multer({ storage }).single('head_image');

// If upload folder doesn't exists, create it.
if (!fs.existsSync(uploadFolderName)) {
  fs.mkdirpSync(uploadFolderName);
}

exports.uploadImage = (req, res, next) => {
  upload(req, res, (uploadErr) => {
    if (uploadErr) {
      log.error('Could not store image', uploadErr);
      return next(new restify.InternalError());
    }

    // If there was an old image, move that away later
    const oldimg = req.event.head_image;

    req.event.head_image = {
      path: req.file.path,
    };

    return req.event.save((saveErr) => {
      if (saveErr) {
        log.error('Could not store image metadata to db', saveErr);
        return next(new restify.InternalError());
      }

      res.json({
        success: true,
        message: 'File uploaded successfully',
        head_image: req.event.head_image,
      });

      // Move old file away
      if (oldimg && oldimg.path) {
        const path = oldimg.path.split('/');
        fs.rename(oldimg.path, `${config.media_dir}/old/${path[path.length - 1]}`, (err) => {
          if (err) {
            log.warn('Could not move unused image into media/old folder', err);
          }
        });
      }

      // Send back the request
      return next();
    });
  });
};
