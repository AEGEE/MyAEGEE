// Validators for the models that Sequelize does not have in the form needed.

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

module.exports = { isOneOf, isInteger, isBoolean };
