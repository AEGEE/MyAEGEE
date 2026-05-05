const parseBody = async (response, parseJson) => {
    const text = await response.text();

    if (!parseJson) {
        return text;
    }

    if (!text) {
        return null;
    }

    try {
        return JSON.parse(text);
    } catch (err) { // eslint-disable-line no-unused-vars
        return text;
    }
};

module.exports.request = async (options) => {
    const parseJson = options.json !== false;
    const headers = { ...(options.headers || {}) };
    const fetchOptions = {
        method: options.method || 'GET',
        headers
    };

    if (options.body !== undefined) {
        if (parseJson) {
            headers['Content-Type'] = headers['Content-Type'] || 'application/json';
            fetchOptions.body = JSON.stringify(options.body);
        } else {
            fetchOptions.body = options.body;
        }
    }

    const response = await fetch(options.url, fetchOptions);
    const body = await parseBody(response, parseJson);

    if (options.resolveWithFullResponse) {
        return {
            statusCode: response.status,
            statusMessage: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            body
        };
    }

    return body;
};
