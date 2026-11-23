const moment = require('moment');

const { Sequelize } = require('./sequelize');

// Validators for the fields of the models. Without one, Sequelize passes a value on as it
// comes, and the database refuses it with an error that is not a validation error.
// Custom validators also run for null, which is for `allowNull` to judge.
const isSet = (value) => value !== null && typeof value !== 'undefined';

// For a BOOLEAN field. Sequelize has made true or false of 'true', 'false', 1 and 0 by now.
exports.isBoolean = (message) => function isBoolean(value) {
    if (isSet(value) && typeof value !== 'boolean') {
        throw new Error(message);
    }
};

// For a DATE or DATEONLY field. Sequelize has made a date of the value by now, which is
// an invalid one (or the text 'Invalid date') if the value was not a date.
exports.isDate = (message) => function isDate(value) {
    if (!isSet(value)) {
        return;
    }

    const date = value instanceof Date ? moment(value) : moment(value, moment.ISO_8601, true);
    if (!date.isValid()) {
        throw new Error(message);
    }
};

// For an ARRAY(STRING) field.
exports.isListOfTexts = (message) => function isListOfTexts(value) {
    if (isSet(value) && (!Array.isArray(value) || value.some((item) => typeof item !== 'string'))) {
        throw new Error(message);
    }
};

// For an ENUM field: one of the values, as a text.
exports.isOneOf = (values, message) => function isOneOf(value) {
    if (isSet(value) && !values.includes(value)) {
        throw new Error(message);
    }
};

// 'first_name' -> 'First name'
const toLabel = (field) => (field.charAt(0).toUpperCase() + field.slice(1)).replace(/_/g, ' ');

// Gives every STRING column of a model a validator for the length of its column, unless it has
// one already. Called for all models in models/index.js, so a new column gets one as well.
exports.addLengthValidators = (model) => {
    for (const [field, attribute] of Object.entries(model.rawAttributes)) {
        const hasMaxLength = attribute.validate && attribute.validate.len && attribute.validate.len.args.length > 1;
        if (!(attribute.type instanceof Sequelize.STRING) || hasMaxLength) {
            continue;
        }

        const maxLength = attribute.type._length; // eslint-disable-line no-underscore-dangle
        attribute.validate = {
            ...attribute.validate,
            isShortEnough(value) {
                if (typeof value === 'string' && value.length > maxLength) {
                    throw new Error(`${toLabel(field)} should be at most ${maxLength} characters long.`);
                }
            }
        };
    }

    model.refreshAttributes();
};
