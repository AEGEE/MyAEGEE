async function parseJsonBody(response) {
    const text = await response.text();

    if (!text) {
        return null;
    }

    return JSON.parse(text);
}

async function requestJson(options) {
    const response = await fetch(options.url, {
        method: options.method || 'GET',
        headers: {
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...(options.headers || {})
        },
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    const body = await parseJsonBody(response);

    if (options.resolveWithFullResponse) {
        return {
            statusCode: response.status,
            body
        };
    }

    return body;
}

async function requestForm(options) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(options.form || {})) {
        params.append(key, value);
    }

    return fetch(options.url, {
        method: options.method || 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            ...(options.headers || {})
        },
        body: params
    });
}

module.exports = {
    requestJson,
    requestForm
};
