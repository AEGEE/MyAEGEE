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

const appendQuery = (url, query) => {
    if (!query) {
        return url;
    }

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

    if (options.form) {
        headers['Content-Type'] = headers['Content-Type'] || 'application/x-www-form-urlencoded';
        fetchOptions.body = new URLSearchParams(options.form).toString();
    }

    const response = await fetch(appendQuery(options.url, options.qs), fetchOptions);
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
