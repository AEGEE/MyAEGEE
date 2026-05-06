const parseBody = async (response) => {
    const text = await response.text();

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
    const headers = { ...(options.headers || {}) };
    const fetchOptions = {
        method: options.method || 'GET',
        headers
    };

    if (options.body !== undefined) {
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        fetchOptions.body = JSON.stringify(options.body);
    }

    const response = await fetch(options.url, fetchOptions);
    const body = await parseBody(response);

    if (options.fullResponse) {
        return {
            statusCode: response.status,
            statusMessage: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            body
        };
    }

    return body;
};
