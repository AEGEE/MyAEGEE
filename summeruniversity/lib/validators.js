// Validators for the models that Sequelize does not have in the form needed.
const moment = require('moment');

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

// The range of a Postgres INTEGER.
const INTEGER_MIN = -2147483648;
const INTEGER_MAX = 2147483647;

// A whole number within the range of a Postgres INTEGER column. Forms send numbers as text,
// so a string of digits counts too. Sequelize's own isInt reads String(value), which an
// array such as [20] passes, and it knows no range, so larger numbers reached the database.
function isInteger(msg) {
    return function isIntegerValue(value) {
        if (value === null || value === undefined) {
            return;
        }

        const number = typeof value === 'string' && /^-?[0-9]+$/.test(value) ? Number(value) : value;
        if (!Number.isInteger(number) || number < INTEGER_MIN || number > INTEGER_MAX) {
            throw new Error(msg);
        }
    };
}

// true or false. Sequelize reads 'true', 'false', 1 and 0 as booleans before validating; any
// other value reached the database, which refused it with a 500. allowNull decides on a
// missing value.
function isBoolean(value) {
    if (value !== null && value !== undefined && typeof value !== 'boolean') {
        throw new Error('The value should be true or false.');
    }
}

// A text. Sequelize turns a number or a boolean into text on the way to the database
// (5 was stored as "5"); arrays and objects it refuses itself. allowNull decides on a missing
// value.
function isText(value) {
    if (value !== null && value !== undefined && typeof value !== 'string') {
        throw new Error('The value should be a text.');
    }
}

// A list. The entries are not checked. allowNull decides on a missing value.
function isList(msg) {
    return function isListValue(value) {
        if (value !== null && value !== undefined && !Array.isArray(value)) {
            throw new Error(msg);
        }
    };
}

// Whether every key of the object is one of `types` and has that type ('string', 'boolean').
const hasOnly = (object, types) => Object.entries(object)
    // eslint-disable-next-line valid-typeof -- the types are typeof names
    .every(([key, value]) => Object.prototype.hasOwnProperty.call(types, key) && typeof value === types[key]);

// The most digits after the decimal point that a Postgres NUMERIC without a precision keeps.
const DECIMAL_SCALE_MAX = 16383;

// A number for a DECIMAL column: a number, or its text as forms send it. Sequelize's own
// isNumeric reads String(value), which an array such as [5] passes; and Postgres refuses
// more decimals than it keeps with a 500.
function isDecimal(msg) {
    return function isDecimalValue(value) {
        if (value === null || value === undefined) {
            return;
        }

        const text = typeof value === 'number' ? String(value) : value;
        const match = typeof text === 'string' && /^[+-]?([0-9]+|[0-9]*\.([0-9]+))$/.exec(text);
        if (!match || (match[2] || '').length > DECIMAL_SCALE_MAX) {
            throw new Error(msg);
        }
    };
}

// A day (2027-07-01) or an ISO 8601 timestamp (2027-07-01T10:30:00.000Z, with or without
// an offset), as the frontend sends them. A number of milliseconds is taken too (isDateMs).
const DATE_FORMAT = /^[0-9]{4}-[0-9]{2}-[0-9]{2}(T[0-9]{2}:[0-9]{2}(:[0-9]{2}(\.[0-9]{1,3})?)?(Z|[+-][0-9]{2}:[0-9]{2})?)?$/;
const isDateText = (value) => typeof value === 'string'
    && DATE_FORMAT.test(value)
    && moment(value, moment.ISO_8601, true).isValid();

// Milliseconds since 1970 (what Date.getTime() gives) within the years 0001-9999, from
// 0001-01-01T00:00:00.000Z to 9999-12-31T23:59:59.999Z. Postgres has no year 0000 (it refuses
// one with a 500), and larger numbers, NaN and Infinity are not dates a client means.
const DATE_MS_MIN = -62135596800000;
const DATE_MS_MAX = 253402300799999;
const isDateMs = (value) => typeof value === 'number' && value >= DATE_MS_MIN && value <= DATE_MS_MAX;

// The setter of a DATE column. Sequelize turns any value of a DATE column into a Date before
// validating it (true became 1970-01-01, "1" became 2001-01-01), so a validator cannot tell
// what was sent. This setter converts only a day, a timestamp or a number of milliseconds,
// keeps a Date, and keeps any other value as it was sent, so that isDate refuses it.
function dateSetter(field) {
    return function setDate(value) {
        this.setDataValue(field, isDateText(value) || isDateMs(value) ? new Date(value) : value);
    };
}

// Whether all the values are valid Dates, so that the validators that put dates in order
// only compare dates (isDate answers for the others).
const areDates = (...values) => values.every((value) => value instanceof Date && !Number.isNaN(value.getTime()));

// A valid Date within the years 0001-9999 (see dateSetter): a day or a timestamp can be in
// the year 0000 too. allowNull decides on a missing value.
function isDate(msg) {
    return function isDateValue(value) {
        if (value !== null && value !== undefined && !(areDates(value) && isDateMs(value.getTime()))) {
            throw new Error(msg);
        }
    };
}

module.exports = {
    isOneOf, isInteger, isBoolean, isText, isDecimal, isList, hasOnly, dateSetter, isDate, areDates
};
