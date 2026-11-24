const { request } = require('./http');

const config = require('../config');

const makeRequest = (options) => {
    const requestOptions = {
        url: options.url,
        method: options.method || 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'X-Auth-Token': options.token,
            'X-Service': 'summeruniversity'
        },
        fullResponse: options.fullResponse || false
    };

    if (options.body) {
        requestOptions.body = options.body;
    }

    if (options.qs) {
        requestOptions.qs = options.qs;
    }

    return request(requestOptions);
};

const getAdminToken = async () => {
    // Getting access and refresh token using admin credentials.
    const authRequest = await makeRequest({
        url: config.core.url + ':' + config.core.port + '/login',
        method: 'POST',
        body: {
            username: config.core.user.login,
            password: config.core.user.password
        }
    });

    if (authRequest === null || typeof authRequest !== 'object') {
        throw new Error('Malformed response when fetching auth request: ' + authRequest);
    }

    if (!authRequest.success) {
        throw new Error('Error fetching auth request: ' + JSON.stringify(authRequest));
    }

    return authRequest.access_token;
};

const fetchUser = async (user, token) => {
    const userRequest = await makeRequest({
        url: config.core.url + ':' + config.core.port + '/members/' + user.user_id,
        token
    });

    if (userRequest === null || typeof userRequest !== 'object') {
        throw new Error('Malformed response when fetching user: ' + userRequest);
    }

    if (!userRequest.success) {
        throw new Error('Error fetching user: ' + JSON.stringify(userRequest));
    }

    return {
        user_id: userRequest.data.id,
        first_name: userRequest.data.first_name,
        last_name: userRequest.data.last_name,
        notification_email: userRequest.data.notification_email,
        role: user.role,
        // Only used to check organizers are members of the organizing bodies.
        body_ids: (userRequest.data.bodies || []).map((body) => body.id)
    };
};

// Fetches an applicant with the admin token. Pass `token` to reuse one (exports fetch
// many applicants); without it, the function logs in itself.
const fetchApplicationUser = async (user, token) => {
    const adminToken = token || await getAdminToken();

    // Fetching user
    const userResponse = await makeRequest({
        url: config.core.url + ':' + config.core.port + '/members/' + user,
        token: adminToken,
    });

    if (userResponse === null || typeof userResponse !== 'object') {
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
    if (typeof body !== 'object' || body === null || typeof body.body_id !== 'number') {
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

    if (bodyRequest === null || typeof bodyRequest !== 'object') {
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

const getBodyUsersForPermission = async (permission, bodyId) => {
    // Getting access and refresh token.
    const authRequest = await makeRequest({
        url: config.core.url + ':' + config.core.port + '/login',
        method: 'POST',
        body: {
            username: config.core.user.login,
            password: config.core.user.password
        }
    });

    if (authRequest === null || typeof authRequest !== 'object') {
        throw new Error('Malformed response when fetching auth request: ' + authRequest);
    }

    if (!authRequest.success) {
        throw new Error('Error fetching auth request: ' + JSON.stringify(authRequest));
    }

    // Fetching members.
    const membersResponse = await makeRequest({
        url: config.core.url + ':' + config.core.port + '/bodies/' + bodyId + '/members',
        token: authRequest.access_token,
        qs: {
            holds_permission: { action: permission.action, object: permission.object }
        }
    });

    if (membersResponse === null || typeof membersResponse !== 'object') {
        throw new Error('Malformed response when fetching members for permission: ' + membersResponse);
    }

    if (!membersResponse.success) {
        throw new Error('Error fetching members for permission: ' + JSON.stringify(membersResponse));
    }

    return membersResponse.data;
};

module.exports = {
    fetchUser,
    fetchApplicationUser,
    fetchBody,
    getBodyUsersForPermission,
    getAdminToken
};
