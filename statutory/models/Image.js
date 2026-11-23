const path = require('path');
const fs = require('fs');

const { Sequelize, sequelize } = require('../lib/sequelize');
const logger = require('../lib/logger');

const Image = sequelize.define('image', {
    user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'User ID should be set.' },
        }
    },
    file_name: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'File name should be set.' },
        }
    },
    file_folder: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Folder should be set.' },
        }
    },
    frontend_path: {
        type: Sequelize.VIRTUAL,
        get() {
            return '/' + this.file_name;
        }
    },
}, {
    underscored: true,
    tableName: 'images',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    // Where the server keeps the file and who uploaded it are not for clients, so an image
    // is read without them, also as part of an event or a candidate. The code that removes
    // the file reads the image unscoped.
    defaultScope: {
        attributes: { exclude: ['file_folder', 'user_id'] }
    }
});

Image.afterDestroy(async (image) => {
    // fs-extra just swallows the error if the file couldn't be deleted.
    const fileName = path.join(image.file_folder, image.file_name);
    try {
        await fs.promises.unlink(fileName);
    } catch (err) {
        logger.warn({ err }, `Could not remove file ${fileName} when deleting image`);
    }
});

module.exports = Image;
