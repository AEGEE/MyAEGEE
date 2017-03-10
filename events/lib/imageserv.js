const restify = require('restify');
const fs = require('fs-extra');
const path = require('path');
const multer = require('multer');
const readChunk = require('read-chunk');
const fileType = require('file-type');

const log = require('./config/logger');
const config = require('./config/config.js');

const uploadFolderName = `${config.media_dir}/headimages`;
const allowedExtensions = ['.png', '.jpg', '.jpeg'];

const storage = multer.diskStorage({ // multers disk storage settings
  destination(req, file, cb) {
    cb(null, uploadFolderName);
  },

  // Filename is 4 character random string and the current datetime to avoid collisions
  filename(req, file, cb) {
    cb(null, `${(Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 4))}-${(new Date()).getTime()}`);
  },
});
const upload = multer({
  storage,
  fileFilter(req, file, cb) {
    const extension = path.extname(file.originalname);
    if (!allowedExtensions.includes(extension)) {
      const allowed = allowedExtensions.map(e => `'${e}'`).join(', ');
      return cb(new Error(`Allowed extensions: ${allowed}, but '${extension}' was passed.`));
    }

    return cb(null, true);
  },
}).single('head_image');

exports.uploadImage = (req, res, next) => {
  // If upload folder doesn't exists, create it.
  if (!fs.existsSync(uploadFolderName)) {
    fs.mkdirpSync(uploadFolderName);
  }

  upload(req, res, (uploadErr) => {
    if (uploadErr) {
      log.error('Could not store image', uploadErr);
      return next(new restify.InternalError({
        body: {
          success: false,
          message: uploadErr.message,
        },
      }));
    }

    // If the head_image field is missing, do nothing.
    if (!req.file) {
      return next(new restify.InternalError({
        body: {
          success: false,
          message: 'No head_image is specified.',
        },
      }));
    }

    // If the file's content is malformed, don't save it.
    const buffer = readChunk.sync(req.file.path, 0, 4100);
    const type = fileType(buffer);

    const originalExtension = path.extname(req.file.originalname);
    const determinedExtension = (type && type.ext ? `.${type.ext}` : 'unknown');

    if (originalExtension !== determinedExtension
      || !allowedExtensions.includes(determinedExtension)) {
      return next(new restify.InternalError({
        body: {
          success: false,
          message: 'Malformed file content.',
        },
      }));
    }


    // If there was an old image, move that away later
    const oldimg = req.event.head_image;

    req.event.head_image = {
      path: req.file.path,
      filename: req.file.filename,
    };

    return req.event.save((saveErr) => {
      if (saveErr) {
        log.error('Could not store image metadata to db', saveErr);
        return next(new restify.InternalError({
          body: {
            success: false,
            message: saveErr.message,
          },
        }));
      }

      res.json({
        success: true,
        message: 'File uploaded successfully',
        data: [req.event.head_image],
      });

      // Move old file away
      if (oldimg && oldimg.path) {
        const oldPath = oldimg.path.split('/');
        fs.rename(oldimg.path, `${config.media_dir}/old/${oldPath[path.length - 1]}`, (err) => {
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
