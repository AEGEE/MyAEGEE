const moment = require('moment');

// Validators and setters for the models that Sequelize does not have in the form needed.

// One of a fixed list of strings. Sequelize's own isIn compares String(value), so an array
// such as ['a'] or an object would pass it and be sent to the database as text. Sequelize
// also runs custom validators on a missing value in a column that allows null; allowNull
// decides there.
function isOneOf(values, msg) {
    return function isOneOfValues(value) {
        if (value !== null && value !== undefined && (typeof value !== 'string' || !values.includes(value))) {
            throw new Error(msg);
        }
    };
}

const INT4_MAX = 2147483647;

// A text: a string or nothing. Sequelize's own checks compare String(value), so a number, an
// array or an object would pass them.
function isText(msg) {
    return function isTextValue(value) {
        if (value !== null && value !== undefined && typeof value !== 'string') {
            throw new Error(msg);
        }
    };
}

// A whole number within [min, max] (the INTEGER column ends at 2^31 - 1), as a number or as a
// string of digits, which forms send.
function isInteger(min, max, msg) {
    return function isIntegerValue(value) {
        if (value === null || value === undefined) {
            return;
        }

        const number = typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : value;
        if (!Number.isInteger(number) || number < min || number > max) {
            throw new Error(msg);
        }
    };
}

// A DECIMAL: a finite number or a string that is one.
function isDecimal(msg) {
    return function isDecimalValue(value) {
        if (value === null || value === undefined) {
            return;
        }

        const isNumber = typeof value === 'number' && Number.isFinite(value);
        const isNumericString = typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value);
        if (!isNumber && !isNumericString) {
            throw new Error(msg);
        }
    };
}

// The date input the API takes: a Date (set by the server), or a string with a date and
// optionally a time, as the frontend sends it ('2026-12-01 15:00') or as ISO 8601.
const DATE_FORMATS = [moment.ISO_8601, 'YYYY-MM-DD HH:mm', 'YYYY-MM-DD HH:mm:ss'];
function isDateInput(value) {
    if (value instanceof Date) {
        return !Number.isNaN(value.getTime());
    }

    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) && moment(value, DATE_FORMATS, true).isValid();
}

// A setter for a DATE column. Without it, Sequelize turns any input into a date with
// new Date(value) first ("1" becomes 2001-01-01). A date input is stored as Sequelize would;
// anything else stays as sent, for dateValidator to refuse.
function dateSetter(field) {
    return function setDate(value) {
        this.setDataValue(field, isDateInput(value) ? new Date(value) : value);
    };
}

// The validator for a DATE column with dateSetter. An empty value is left to notEmpty and
// allowNull.
function dateValidator(msg) {
    return function isDateValue(value) {
        if (value !== null && value !== undefined && value !== '' && !isDateInput(value)) {
            throw new Error(msg);
        }
    };
}

// A setter that stores the value as sent. Sequelize turns 1, 0, 'true' and 'false' into
// booleans for a BOOLEAN column before the validators see them.
function plainSetter(field) {
    return function setPlain(value) {
        this.setDataValue(field, value);
    };
}

const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

// Keeps only the given keys of a plain object; anything else is returned as it is, for the
// validators to refuse.
function pickKeys(value, keys) {
    if (!isPlainObject(value)) {
        return value;
    }

    return Object.fromEntries(keys.filter((key) => key in value).map((key) => [key, value[key]]));
}

module.exports = {
    INT4_MAX,
    isOneOf,
    isText,
    isInteger,
    isDecimal,
    isDateInput,
    dateSetter,
    dateValidator,
    plainSetter,
    isPlainObject,
    pickKeys
};
