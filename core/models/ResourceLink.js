const { Sequelize, sequelize } = require('../lib/sequelize');

// Browsers treat `//host` and `/\host` as another site, so only one leading slash.
const INTERNAL_PATH = /^\/(?![/\\])[^\s\\]*$/;

const isResourceUrl = (value) => {
    if (typeof value !== 'string') {
        return false;
    }

    if (value.startsWith('/')) {
        return INTERNAL_PATH.test(value);
    }

    if (/\s/.test(value)) {
        return false;
    }

    let url;
    try {
        url = new URL(value);
    } catch (err) { // eslint-disable-line no-unused-vars
        return false;
    }

    return ['http:', 'https:'].includes(url.protocol) && url.hostname !== '';
};

const ResourceLink = sequelize.define('resource_link', {
    category_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: {
            notNull: { msg: 'Section should be set.' },
            isInt: { msg: 'Section ID should be a number.' }
        }
    },
    title: {
        type: Sequelize.STRING(100),
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Title should be set.' },
            notNull: { msg: 'Title should be set.' },
            len: { args: [1, 100], msg: 'Title should be at most 100 characters long.' }
        }
    },
    description: {
        type: Sequelize.STRING(255),
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Description should be set.' },
            notNull: { msg: 'Description should be set.' },
            len: { args: [1, 255], msg: 'Description should be at most 255 characters long.' }
        }
    },
    url: {
        type: Sequelize.STRING(2048),
        allowNull: false,
        validate: {
            notEmpty: { msg: 'URL should be set.' },
            notNull: { msg: 'URL should be set.' },
            len: { args: [1, 2048], msg: 'URL should be at most 2048 characters long.' },
            isResourceUrl(value) {
                if (!isResourceUrl(value)) {
                    throw new Error('URL should be a MyAEGEE path starting with / or an http(s):// address.');
                }
            }
        }
    },
    position: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
    }
}, {
    underscored: true,
    tableName: 'resource_links',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

ResourceLink.beforeValidate((link) => {
    for (const field of ['title', 'description', 'url']) {
        if (typeof link[field] === 'string') link[field] = link[field].trim();
    }
});

module.exports = ResourceLink;
