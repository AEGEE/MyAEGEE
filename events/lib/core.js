const request = require('request-promise-native');

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
        simple: false,
        json: true,
        resolveWithFullResponse: options.resolveWithFullResponse || false
    };

    if (options.body) {
        requestOptions.body = options.body;
    }

    return request(requestOptions);
};

const fetchUser = async (user, token) => {
    const userRequest = await makeRequest({
        url: config.core.url + ':' + config.core.port + '/members/' + user.user_id,
        token
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
        notification_email: userRequest.data.notification_email
    };
};

const fetchApplicationUser = async (user) => {
    // Getting access and refresh token.
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

    // Fetching user
    const userResponse = await makeRequest({
        url: config.core.url + ':' + config.core.port + '/members/' + user,
        token: authRequest.access_token,
    });

    if (typeof userResponse !== 'object') {
        throw new Error('Malformed response when fetching user: ' + userResponse);
    }

    if (!userResponse.success) {
        throw new Error('Error fetching user: ' + JSON.stringify(userResponse));
    }

    return userResponse.data;
};

const fetchBody = async (body, token) => {
    // return invalid body as it is, will catch it in Event validation.
    if (typeof body !== 'object' || typeof body.body_id !== 'number') {
        return body;
    }

    const bodyRequest = await makeRequest({
        url: config.core.url + ':' + config.core.port + '/bodies/' + body.body_id,
        token
    });

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
    fetchUser,
    fetchApplicationUser,
    fetchBody
};
