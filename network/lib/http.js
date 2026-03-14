async function requestJson(options) {
    const response = await fetch(options.url, {
        method: options.method || 'GET',
        headers: {
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...(options.headers || {})
        },
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    const text = await response.text();
    const body = text ? JSON.parse(text) : null;

    if (options.resolveWithFullResponse) {
        return {
            statusCode: response.status,
            body
        };
    }

    return body;
}

module.exports = {
    requestJson
};
