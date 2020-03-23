const crypto = require('crypto');
const { Sequelize } = require('./sequelize');

// A helper to flatten the nested object. Copypasted from Google.
function flattenObject(obj, prefix = '') {
    return Object.keys(obj).reduce((acc, k) => {
        const pre = prefix.length ? prefix + '.' : '';
        if (typeof obj[k] === 'object' && obj[k] !== null && Object.prototype.toString.call(obj[k]) !== '[object Date]') {
            Object.assign(acc, flattenObject(obj[k], pre + k));
        } else {
            acc[pre + k] = obj[k];
        }

        return acc;
    }, {});
}

/* eslint-disable */
function unflattenObject(data) {
    const result = {};

    for (const i in data) {
        const keys = i.split('.');
        keys.reduce((r, e, j) => {
            return r[e] || (r[e] = isNaN(Number(keys[j + 1])) ? (keys.length - 1 == j ? data[i] : {}) : []);
        }, result);
    }
    return result;
}
/* eslint-enable */

function filterFields(body, fieldsToFilter) {
    const flatten = flattenObject(body);
    for (const field in flatten) {
        if (fieldsToFilter.some((filterField) => field === filterField)) {
            flatten[field] = '[FILTERED]';
        }
    }

    return unflattenObject(flatten);
}

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
    returns an array like following:

    [
        { field1: { [Sequelize.Op.iLike]: '%query%' } },
        { field2: { [Sequelize.Op.iLike]: '%query%' } },
        ...
    ]

    Required for filtering stuff.
*/
function filterBy(query, fields) {
    if (typeof query !== 'string' || query.trim().length === 0) {
        return {};
    }

    return {
        [Sequelize.Op.or]: fields.map((field) => {
            return {
                [field]: { [Sequelize.Op.iLike]: '%' + query + '%' }
            };
        })
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

        whereObject[field] = queryField;
    }

    return whereObject;
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

module.exports = {
    filterFields,
    flattenObject,
    unflattenObject,
    isNumber,
    traverseIndirectCircles,
    getPagination,
    getSorting,
    filterBy,
    findBy,
    getRandomBytes
};
