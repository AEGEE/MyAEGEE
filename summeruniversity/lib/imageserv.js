const path = require('path');
const util = require('util');
const fs = require('fs');
const multer = require('multer');
const { fileTypeFromFile } = require('file-type');

const errors = require('./errors');
const log = require('./logger');
const config = require('../config');

const uploadFolderName = `${config.media_dir}/headimages`;
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
// Profile and event pictures; a photo from a phone fits well within this.
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const upload = multer({
    storage,
    limits: { fileSize: MAX_IMAGE_SIZE, files: 1, fields: 10 },
    fileFilter(req, file, cb) {
        const extension = path.extname(file.originalname).toLowerCase();
        if (!allowedExtensions.includes(extension)) {
            const allowed = allowedExtensions.map((e) => `'${e}'`).join(', ');
            return cb(new Error(`Allowed extensions: ${allowed}, but '${extension}' was passed.`));
        }

        return cb(null, true);
    },
}).single('head_image');

const uploadAsync = util.promisify(upload);

// Removes a file from disk. A file that's already gone (or can't be removed) is
// only logged: by then the event points to the new image, so the request succeeded.
const removeFile = async (filePath) => {
    try {
        await fs.promises.unlink(filePath);
    } catch (err) {
        log.warn({ err, filePath }, 'Could not remove image file');
    }
};

exports.uploadImage = async (req, res) => {
    // Only those who can edit the event can change its image.
    if (!req.permissions.edit_summeruniversity) {
        return errors.makeForbiddenError(res, 'You cannot edit this event');
    }

    const oldimg = req.event.image;

    // If upload folder doesn't exists, create it.
    if (!fs.existsSync(uploadFolderName)) {
        await fs.promises.mkdir(uploadFolderName, { recursive: true });
    }

    try {
        await uploadAsync(req, res);
    } catch (err) {
        log.error({ err }, 'Could not store image');

        if (err.code === 'LIMIT_FILE_SIZE') {
            return errors.makeValidationError(res, 'The image should be at most 5 MB.');
        }

        if (err.message === 'Unexpected end of form') {
            return errors.makeValidationError(res, 'No head_image is specified.');
        }

        return errors.makeValidationError(res, err);
    }

    // If the head_image field is missing, do nothing.
    if (!req.file) {
        return errors.makeValidationError(res, 'No head_image is specified.');
    }

    // If the file's content is malformed, don't save it.
    const type = await fileTypeFromFile(req.file.path);

    // file-type reports every JPEG as 'jpg', so compare '.jpeg' uploads as '.jpg'.
    const originalExtension = path.extname(req.file.originalname).toLowerCase().replace(/^\.jpeg$/, '.jpg');
    const determinedExtension = (type && type.ext ? `.${type.ext}` : 'unknown');

    if (originalExtension !== determinedExtension || !allowedExtensions.includes(determinedExtension)) {
        await removeFile(req.file.path);
        return errors.makeValidationError(res, 'Malformed file content.');
    }

    await req.event.update({
        image: req.file.filename
    });

    // Remove old file
    if (oldimg) {
        await removeFile(path.join(uploadFolderName, oldimg));
    }

    return res.json({
        success: true,
        message: 'File uploaded successfully',
        data: req.event.image,
    });
};
