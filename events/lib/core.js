const { request } = require('./http');

const config = require('../config');

const makeRequest = (options) => {
    const requestOptions = {
        url: options.url,
        method: options.method || 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'X-Auth-Token': options.token,
            'X-Service': 'events'
        },
        fullResponse: options.fullResponse || false
    };

    if (options.body) {
        requestOptions.body = options.body;
    }

    return request(requestOptions);
};

const getAdminToken = async () => {
    // Getting access and refresh token using the service account credentials.
    const authRequest = await makeRequest({
        url: config.core.url + ':' + config.core.port + '/login',
        method: 'POST',
        body: {
            username: config.core.user.login,
            password: config.core.user.password
        }
    });

    if (typeof authRequest !== 'object') {
        throw new Error('Malformed response when fetching auth request: ' + authRequest);
    }

    if (!authRequest.success) {
        throw new Error('Error fetching auth request: ' + JSON.stringify(authRequest));
    }

    return authRequest.access_token;
};

// Fetches an organizer with the service account token (from getAdminToken), so it works
// regardless of whether the person editing the event may see this user in core.
// `body_ids` is only used for validation and should not be stored.
const fetchUser = async (user, adminToken) => {
    const userRequest = await makeRequest({
        url: config.core.url + ':' + config.core.port + '/members/' + user.user_id,
        token: adminToken
    });

    if (typeof userRequest !== 'object') {
        throw new Error('Malformed response when fetching user: ' + userRequest);
    }

    if (!userRequest.success) {
        throw new Error('Error fetching user: ' + JSON.stringify(userRequest));
    }

    return {
        user_id: userRequest.data.id,
        comment: user.comment,
        first_name: userRequest.data.first_name,
        last_name: userRequest.data.last_name,
        email: userRequest.data.email,
        notification_email: userRequest.data.notification_email,
        body_ids: userRequest.data.bodies.map((body) => body.id)
    };
};

const fetchApplicationUser = async (user) => {
    const adminToken = await getAdminToken();

    // Fetching user
    const userResponse = await makeRequest({
        url: config.core.url + ':' + config.core.port + '/members/' + user,
        token: adminToken,
    });

    if (typeof userResponse !== 'object') {
        throw new Error('Malformed response when fetching user: ' + userResponse);
    }

    if (!userResponse.success) {
        throw new Error('Error fetching user: ' + JSON.stringify(userResponse));
    }

    return userResponse.data;
};

// Returns { body_id, body_name }, or null if core does not know or does not show the body.
const fetchBody = async (body, token) => {
    // return invalid body as it is, will catch it in Event validation.
    if (typeof body !== 'object' || typeof body.body_id !== 'number') {
        return body;
    }

    const response = await makeRequest({
        url: config.core.url + ':' + config.core.port + '/bodies/' + body.body_id,
        token,
        fullResponse: true
    });

    // Core answers 404 for an unknown body and 403 for a deleted one (unless the user may
    // see deleted bodies). The caller reports those as a validation error.
    if ([403, 404].includes(response.statusCode)) {
        return null;
    }

    const bodyRequest = response.body;

    if (typeof bodyRequest !== 'object') {
        throw new Error('Malformed response when fetching body: ' + bodyRequest);
    }

    if (!bodyRequest.success) {
        throw new Error('Error fetching body: ' + JSON.stringify(bodyRequest));
    }

    return {
        body_id: bodyRequest.data.id,
        body_name: bodyRequest.data.name
    };
};

module.exports = {
    getAdminToken,
    fetchUser,
    fetchApplicationUser,
    fetchBody
};
