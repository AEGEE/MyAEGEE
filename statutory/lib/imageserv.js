const path = require('path');
const util = require('util');
const fs = require('fs');
const multer = require('multer');
const { fileTypeFromFile } = require('file-type');

const errors = require('./errors');
const log = require('./logger');
const config = require('../config');
const { Image } = require('../models');

const uploadFolderName = config.images_dir;
const allowedExtensions = ['.png', '.jpg', '.jpeg'];

const storage = multer.diskStorage({ // multers disk storage settings
    destination(req, file, cb) {
        cb(null, uploadFolderName);
    },

    // Filename is 4 character random string and the current datetime to avoid collisions
    filename(req, file, cb) {
        const prefix = Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 4);
        const date = (new Date()).getTime();
        const extension = path.extname(file.originalname).toLowerCase();

        cb(null, `${prefix}-${date}${extension}`);
    },
});
const upload = multer({
    storage,
    fileFilter(req, file, cb) {
        const extension = path.extname(file.originalname).toLowerCase();
        if (!allowedExtensions.includes(extension)) {
            const allowed = allowedExtensions.map((e) => `'${e}'`).join(', ');
            return cb(new Error(`Allowed extensions: ${allowed}, but '${extension}' was passed.`));
        }

        return cb(null, true);
    },
}).single('image');

const uploadAsync = util.promisify(upload);

// Checks the permission before uploadImage runs, so a refused upload never stores a file.
exports.requirePermission = (permission, message) => (req, res, next) => {
    if (!req.permissions[permission]) {
        return errors.makeForbiddenError(res, message);
    }

    return next();
};

exports.uploadImage = async (req, res, next) => {
    // If upload folder doesn't exists, create it.
    if (!fs.existsSync(uploadFolderName)) {
        await fs.promises.mkdir(uploadFolderName, { recursive: true });
    }

    try {
        await uploadAsync(req, res);
    } catch (err) {
        log.error('Could not store image', err);

        if (err.message === 'Unexpected end of form') {
            return errors.makeValidationError(res, 'No image is specified.');
        }

        return errors.makeValidationError(res, err);
    }

    // If the image field is missing, do nothing.
    if (!req.file) {
        return errors.makeValidationError(res, 'No image is specified.');
    }

    // If the file's content is malformed, don't save it.
    const type = await fileTypeFromFile(req.file.path);

    // file-type reports every JPEG as 'jpg', so compare '.jpeg' uploads as '.jpg'.
    const originalExtension = path.extname(req.file.originalname).toLowerCase().replace(/^\.jpeg$/, '.jpg');
    const determinedExtension = (type && type.ext ? `.${type.ext}` : 'unknown');

    if (originalExtension !== determinedExtension || !allowedExtensions.includes(determinedExtension)) {
        await fs.promises.unlink(req.file.path).catch((err) => log.warn({ err }, 'Could not remove rejected image'));
        return errors.makeValidationError(res, 'Malformed file content.');
    }

    const image = await Image.create({
        user_id: req.user.id,
        file_name: req.file.filename,
        file_folder: uploadFolderName
    });

    req.image = image;
    return next();
};
