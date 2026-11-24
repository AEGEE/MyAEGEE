const path = require('path');

const config = require('../../config');
// Root-level shared helper; becomes a workspace package after the pnpm restructure.
const { createRequestHook } = require('../../../packages/backend-test-utils/openapi');

// Checks every response (and every accepted JSON request body) against openapi.yaml.
const checkResponse = createRequestHook({ serviceRoot: path.join(__dirname, '..', '..') });

const baseUrl = 'http://localhost:' + config.port;

const appendQuery = (url, query) => {
    if (!query) return url;

    const requestUrl = new URL(url);
    for (const [key, value] of Object.entries(query)) {
        if (Array.isArray(value)) {
            value.forEach((item) => requestUrl.searchParams.append(key, item));
        } else if (typeof value === 'object' && value !== null) {
            for (const [nestedKey, nestedValue] of Object.entries(value)) {
                requestUrl.searchParams.append(`${key}[${nestedKey}]`, nestedValue);
            }
        } else {
            requestUrl.searchParams.append(key, value);
        }
    }

    return requestUrl.toString();
};

const request = async (options) => {
    const responseType = options.responseType || 'json';
    const headers = { ...(options.headers || {}) };
    const fetchOptions = { method: options.method || 'GET', headers };

    if (options.body !== undefined) {
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        fetchOptions.body = JSON.stringify(options.body);
    }

    const response = await fetch(appendQuery(new URL(options.path, baseUrl + '/').toString(), options.query), fetchOptions);
    const text = await response.text();
    let body = text;

    if (responseType === 'json' && text) {
        try {
            body = JSON.parse(text);
        } catch (err) { // eslint-disable-line no-unused-vars
            body = text;
        }
    }

    const result = {
        statusCode: response.status,
        statusMessage: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body
    };
    checkResponse(options, fetchOptions, result);
    return result;
};

exports.request = request;
