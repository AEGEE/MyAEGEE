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

module.exports = {
    filterFields,
    flattenObject,
    unflattenObject,
    isNumber
};
