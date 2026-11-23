const crypto = require('crypto');
const { sequelize, Sequelize } = require('./sequelize');
const constants = require('./constants');
const { BadRequestError } = require('./errors');

// A helper to traverse indirect circles (so if a person is a member
// of a circle which is a child circle, it should return both of the circles.)
// Required for recursive circles schema.
// Accepts 2 params, all circles map (with key as ID and value as circle)
// and circlesIds (array of ids), returns array of ids to be consumed
// by Sequelize.Op.in
function traverseIndirectCircles(allCirclesMap, circlesIds) {
    const indirectCircles = {};
    const traverseIndirectCirclesRecursive = (circleId) => {
        indirectCircles[circleId] = true;
        if (!allCirclesMap[circleId].parent_circle_id) {
            return;
        }

        return traverseIndirectCirclesRecursive(allCirclesMap[circleId].parent_circle_id);
    };

    for (const id of circlesIds) {
        traverseIndirectCirclesRecursive(id);
    }

    return Object.keys(indirectCircles);
}

// The highest ID (and the highest limit and offset) that fits the integer columns of the database.
const MAX_ID = 2147483647;

// For a value that should be the ID of something: returns it as a number, or null if it's not
// a positive whole number that an ID can be (given as a number or as a text of digits).
const parseId = (value) => {
    const id = typeof value === 'string' && /^[0-9]+$/.test(value) ? Number(value) : value;
    return Number.isSafeInteger(id) && id > 0 && id <= MAX_ID ? id : null;
};

// A limit or an offset that is not a positive whole number is left out, like one that is not given.
function getPagination(query) {
    const result = {};

    const limit = parseId(query.limit);
    if (limit) {
        result.limit = limit;
    }

    const offset = parseId(query.offset);
    if (offset) {
        result.offset = offset;
    }

    return result;
}

// The fields a list of this model can be sorted by: the columns that its rows have.
// That leaves out what the model never returns (the password of a member), so the order
// of a list tells nothing about it, and what is computed and not stored.
function getSortableFields(model) {
    const { defaultScope } = model.options;
    const hidden = (defaultScope && defaultScope.attributes && defaultScope.attributes.exclude) || [];

    return Object.keys(model.rawAttributes).filter((field) => {
        return !hidden.includes(field) && !(model.rawAttributes[field].type instanceof Sequelize.VIRTUAL);
    });
}

function getSorting(query, model) {
    const result = [['id', 'ASC']];

    if (typeof query.sort === 'string') {
        if (!getSortableFields(model).includes(query.sort)) {
            throw new BadRequestError('The list cannot be sorted by this field.');
        }

        result[0][0] = query.sort;
    }

    if (typeof query.direction === 'string' && ['desc', 'asc'].includes(query.direction)) {
        result[0][1] = query.direction;
    }

    return result;
}

/*
    Given a string like 'query' and fields like ['field1', 'field2'...]
    returns an object like following:

    {
        names: Sequelize.where(
            Sequelize.fn('concat', Sequelize.col('field1'), ' ', 'Sequelize.col('field2'), ...)
            { [Sequelize.Op.iLike]: '%query%' }
        }
    }

    Required for filtering stuff.
*/
function filterBy(query, fields) {
    if (typeof query !== 'string' || query.trim().length === 0) {
        return {};
    }

    const concatFields = [];
    for (let i = 0; i < fields.length; i++) {
        concatFields.push(Sequelize.col(fields[i]));
        if (i < fields.length - 1) {
            concatFields.push(' ');
        }
    }

    return {
        namesQuery: Sequelize.where(
            Sequelize.fn('concat', ...concatFields),
            { [Sequelize.Op.iLike]: '%' + query + '%' }
        )
    };
}

/*
    Given a object like { field1: 'value1', field2: 'value2', field3: 'value3 }
    and fields like { field1: 'string', field2: 'array' },
    returns an object like following:

    {
        field1: value1,
        field2: { [Sequelize.Op.in]: [value2a, value2b] }
    }

    A value that is not a text is refused with a BadRequestError.
    Required for filtering stuff.
*/
function findBy(query, fields) {
    /* istanbul ignore if */
    if (typeof query !== 'object' || query === null) {
        return {};
    }

    const whereObject = {};

    for (const field in fields) {
        const type = fields[field];
        const queryField = query[field];

        if (!queryField) {
            continue;
        }

        // Both kinds of filters come as a text; a list is a text with commas.
        if (typeof queryField !== 'string' || queryField.trim().length === 0) {
            throw new BadRequestError(`The "${field}" filter should be a text.`);
        }

        if (type === 'array') {
            whereObject[field] = { [Sequelize.Op.in]: queryField.split(',') };
            continue;
        }

        whereObject[field] = queryField;
    }

    return whereObject;
}

// For a field of a request body that should be a text: anything else counts as not given.
const stringOrEmpty = (value) => (typeof value === 'string' ? value : '');

// A helper to whilelist object's properties.
function whitelistObject(object, allowedFields) {
    const newObject = {};
    for (const field of allowedFields) {
        newObject[field] = object[field];
    }

    return newObject;
}

function getRandomBytes(length) {
    return new Promise((resolve, reject) => {
        crypto.randomBytes(length / 2, (err, res) => {
            /* istanbul ignore if */
            if (err) {
                return reject(err);
            }

            return resolve(res.toString('hex'));
        });
    });
}

function getMailText({ user, mailinglists }) {
    return `OK BEGIN
REG ${user.first_name} ${user.last_name}
SUBSCRIBE ${mailinglists.join('\r\nSUBSCRIBE ')}
OK END`;
}

// A helper to add data to gauge Prometheus metric.
const addGaugeData = (gauge, array) => {
    // reset gauge...
    gauge.reset();

    // and set it with values
    for (const element of array) {
        const {
            value,
            ...data
        } = element;

        gauge.set(data, value);
    }
};

// A condition for a column being equal to a value, ignoring the case.
// Unlike with iLike, `%` and `_` in the value are just characters.
// The value is lowercased here and not by the database: Sequelize would change a `$` in an argument of a function.
const equalsIgnoreCase = (column, value) => Sequelize.where(
    Sequelize.fn('lower', Sequelize.col(column)),
    String(value).toLowerCase()
);

// Blocks the restricted domains and their subdomains, but not e.g. 'notaegee.org'.
const isRestrictedEmail = (email) => {
    const normalized = email.trim().toLowerCase();
    return constants.RESTRICTED_EMAILS.some((domain) => normalized.endsWith('@' + domain) || normalized.endsWith('.' + domain));
};

// Email changes and password resets of one member are processed one by one. An advisory
// lock does that without locking the member's row, which every request of that member
// writes to (last_active), so the member is not held up while the mails are sent.
const MAIL_CHANGE_LOCK_NAMESPACE = 1;
const lockMailChanges = (userId, transaction) => sequelize.query(
    'SELECT pg_advisory_xact_lock(:namespace, :user_id)',
    { replacements: { namespace: MAIL_CHANGE_LOCK_NAMESPACE, user_id: userId }, transaction }
);

module.exports = {
    traverseIndirectCircles,
    getPagination,
    getSorting,
    filterBy,
    findBy,
    whitelistObject,
    getRandomBytes,
    getMailText,
    addGaugeData,
    equalsIgnoreCase,
    isRestrictedEmail,
    lockMailChanges,
    parseId,
    stringOrEmpty
};
