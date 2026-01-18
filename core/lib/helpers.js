const crypto = require('crypto');
const { Sequelize } = require('./sequelize');

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

// Figure out if the value is a number or a string containing only numbers
function isNumber(value) {
    /* istanbul ignore if */
    if (typeof value === 'number') {
        return true;
    }

    /* istanbul ignore else */
    if (typeof value === 'string') {
        const valueAsNumber = +value; // converts to number if it's all numbers or to NaN otherwise
        return !Number.isNaN(valueAsNumber);
    }

    // Is not covered, probably will be in the future.
    /* istanbul ignore next */
    return false;
}

function getPagination(query) {
    const result = {};

    if (query.limit && isNumber(query.limit) && query.limit > 0) {
        result.limit = +query.limit;
    }

    if (query.offset && isNumber(query.offset) && query.offset > 0) {
        result.offset = +query.offset;
    }

    return result;
}

function getSorting(query) {
    const result = [['id', 'ASC']];

    if (typeof query.sort === 'string') {
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
    and fields like [{field1: 'boolean'}, {field2: 'string'},...],
    returns an array like following:

    [
        { field1: value1 },
        { field2: value2 },
        ...
    ]

    Also validates the field to be correct.
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

        /* istanbul ignore next */
        if (type === 'boolean' && !['true', 'false'].includes(queryField)) {
            throw new Error(`The "${field}" value should be boolean, but received "${queryField}.`);
        }

        /* istanbul ignore if */
        if (type === 'string' && (typeof queryField !== 'string' || queryField.trim().length === 0)) {
            throw new Error(`The "${field}" value should be string, but received "${queryField}`);
        }

        /* istanbul ignore next */
        if (type === 'array') {
            if (typeof queryField !== 'string' || queryField.trim().length === 0) {
                throw new Error(`The "${field}" value should be string, but received "${queryField}`);
            }

            whereObject[field] = { [Sequelize.Op.in]: queryField.split(',') };
            continue;
        }

        whereObject[field] = queryField;
    }

    return whereObject;
}

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

module.exports = {
    isNumber,
    traverseIndirectCircles,
    getPagination,
    getSorting,
    filterBy,
    findBy,
    whitelistObject,
    getRandomBytes,
    getMailText,
    addGaugeData
};
