const fs = require('fs');
const path = require('path');

const config = require('../../config');

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
    const parseJson = options.json !== false;
    const headers = { ...(options.headers || {}) };
    const fetchOptions = { method: options.method || 'GET', headers };

    if (options.body !== undefined) {
        if (parseJson) {
            headers['Content-Type'] = headers['Content-Type'] || 'application/json';
            fetchOptions.body = JSON.stringify(options.body);
        } else {
            fetchOptions.body = options.body;
        }
    }

    if (options.formData) {
        const entries = Object.entries(options.formData);
        const formData = new FormData();
        for (const [key, item] of entries) {
            const value = item && item.value ? item.value : item;
            const filename = item && item.options && item.options.filename
                ? item.options.filename
                : path.basename(value.path);
            const buffer = fs.readFileSync(value.path);
            formData.append(key, new Blob([buffer]), filename);
        }
        if (entries.length > 0) {
            fetchOptions.body = formData;
        }
    }

    const response = await fetch(appendQuery(new URL(options.uri, baseUrl + '/').toString(), options.qs), fetchOptions);
    if (options.encoding === null) {
        return {
            statusCode: response.status,
            statusMessage: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            body: Buffer.from(await response.arrayBuffer())
        };
    }

    const text = await response.text();
    let body = text;

    if (parseJson && text) {
        try {
            body = JSON.parse(text);
        } catch (err) { // eslint-disable-line no-unused-vars
            body = text;
        }
    }

    return {
        statusCode: response.status,
        statusMessage: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body
    };
};

exports.request = request;
