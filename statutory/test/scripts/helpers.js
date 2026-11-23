const fs = require('fs');
const path = require('path');

const config = require('../../config');
// Root-level shared helper; becomes a workspace package after the pnpm restructure.
const { createRequestHook } = require('../../../packages/backend-test-utils/openapi');

// Checks every response (and every accepted JSON request body) against openapi.yaml.
const checkContract = createRequestHook({ serviceRoot: path.join(__dirname, '..', '..') });

// The check gets the body as the server receives it: the tests pass Date objects, which
// travel as ISO strings, and keys set to undefined, which do not travel at all.
const checkResponse = (options, fetchOptions, result) => {
    const sent = options.body !== null && typeof options.body === 'object'
        ? { ...options, body: JSON.parse(JSON.stringify(options.body)) }
        : options;
    checkContract(sent, fetchOptions, result);
};

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

    // A body sent as it is (a string or a Buffer), for bodies that are not valid JSON.
    if (options.rawBody !== undefined) {
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        fetchOptions.body = options.rawBody;
    }

    if (options.files) {
        const entries = Object.entries(options.files);
        const formData = new FormData();
        for (const [key, item] of entries) {
            const filename = item.filename || path.basename(item.path);
            const buffer = item.buffer || fs.readFileSync(item.path);
            formData.append(key, new Blob([buffer]), filename);
        }
        for (const [key, value] of Object.entries(options.fields || {})) {
            formData.append(key, value);
        }
        if (entries.length > 0 || options.fields) {
            fetchOptions.body = formData;
        } else {
            headers['Content-Type'] = 'multipart/form-data; boundary=empty-form';
            fetchOptions.body = '--empty-form\r\n';
        }
    }

    const response = await fetch(appendQuery(new URL(options.path, baseUrl + '/').toString(), options.query), fetchOptions);
    if (responseType === 'buffer') {
        const binary = {
            statusCode: response.status,
            statusMessage: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            body: Buffer.from(await response.arrayBuffer())
        };
        checkResponse(options, fetchOptions, binary);
        return binary;
    }

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
