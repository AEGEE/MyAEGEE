const bunyan = require('bunyan');

const configFile = require('../config');
const packageInfo = require('../package');

const logger = bunyan.createLogger({
    name: packageInfo.name,
    level: configFile.logger.silent ? bunyan.FATAL + 1 : configFile.logger.level,
    serializers: bunyan.stdSerializers
});

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

const filterFields = (body) => {
    const flatten = flattenObject(body);
    for (const field in flatten) {
        if (configFile.filter_fields.some((filterField) => field.includes(filterField))) {
            flatten[field] = '*'.repeat(flatten[field].length);
        }
    }

    return unflattenObject(flatten);
};

logger.addSerializers({
    body: (body) => filterFields(body),
    config: (config) => filterFields(config),
    headers: (headers) => filterFields(headers)
});

module.exports = logger;
