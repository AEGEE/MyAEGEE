const moment = require('moment');

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
