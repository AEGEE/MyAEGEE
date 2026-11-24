const fs = require('fs');
const path = require('path');

const { unmockedRequest } = require('../../../packages/backend-test-utils/unmocked-request');
// Root-level shared helper; becomes a workspace package after the pnpm restructure.
const { createRequestHook } = require('../../../packages/backend-test-utils/openapi');

const config = require('../../config');

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
    // Connection: close, so that no keep-alive socket outlives the server that a test file
    // stops: fetch would otherwise reuse a socket of a closed server (ECONNRESET).
    const headers = { Connection: 'close', ...(options.headers || {}) };
    const fetchOptions = { method: options.method || 'GET', headers };

    if (options.body !== undefined) {
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        fetchOptions.body = JSON.stringify(options.body);
    }

    // A raw string body, e.g. to send malformed JSON.
    if (options.rawBody !== undefined) {
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

    // The check sees the request body as the server got it: the raw text, or the JSON
    // (dates and other objects serialized).
    let checkOptions = options;
    if (options.rawBody !== undefined) {
        checkOptions = { ...options, body: options.rawBody };
    } else if (options.body !== undefined) {
        checkOptions = { ...options, body: JSON.parse(JSON.stringify(options.body)) };
    }

    // Malformed encodings must be rejected by the service, not by Nock's decompressor.
    const encodedBody = options.rawBody !== undefined && Object.keys(headers).some((key) => key.toLowerCase() === 'content-encoding');
    const send = encodedBody ? unmockedRequest : fetch;
    const response = await send(appendQuery(new URL(options.path, baseUrl + '/').toString(), options.query), fetchOptions);
    if (responseType === 'buffer') {
        const bufferResult = {
            statusCode: response.status,
            statusMessage: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            body: Buffer.from(await response.arrayBuffer())
        };
        checkResponse(checkOptions, fetchOptions, bufferResult);
        return bufferResult;
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
    checkResponse(checkOptions, fetchOptions, result);
    return result;
};

exports.request = request;
