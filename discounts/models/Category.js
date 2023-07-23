const Joi = require('joi');
const { Sequelize, sequelize } = require('../lib/sequelize');

const categoriesSchema = Joi.array().min(1).items(Joi.object().keys({
    icon: Joi.string().trim().required(),
    name: Joi.string().trim().required(),
    shortDescription: Joi.string().trim().required(),
    longDescription: Joi.string().trim().required(),
}));

const Category = sequelize.define('category', {
    name: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Name should be set.' },
        },
    },
    discounts: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: '',
        validate: {
            isValid(categoriesValue) {
                const { error, value } = categoriesSchema.validate(categoriesValue);
                if (error) {
                    throw error;
                }

                // eslint-disable-next-line no-param-reassign
                categoriesValue = value;
            }
        },
    }
}, {
    underscored: true,
    tableName: 'categories',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Category;
