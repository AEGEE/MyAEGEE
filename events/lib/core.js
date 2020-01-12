const request = require('request-promise-native');

const config = require('../config');

const makeRequest = (options) => {
    const requestOptions = {
        url: options.url,
        method: options.method || 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'X-Auth-Token': options.token,
        },
        simple: false,
        json: true,
        resolveWithFullResponse: options.resolveWithFullResponse || false
    };

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
        user_id: user.user_id,
        comment: user.comment,
        first_name: userRequest.data.first_name,
        last_name: userRequest.data.last_name,
        email: userRequest.data.user.email
    };
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

const fetchUsersWithPermission = async (permission) => {
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
        throw new Error('Malformed response when fetching auth: ' + authRequest);
    }

    if (!authRequest.success) {
        throw new Error('Error fetching auth: ' + JSON.stringify(authRequest));
    }

    // Fetching permissions.
    const permissionsResponse = await makeRequest({
        url: config.core.url + ':' + config.core.port + '/permissions',
        token: authRequest.access_token
    });

    if (typeof permissionsResponse !== 'object') {
        throw new Error('Malformed response when fetching permissions: ' + permissionsResponse);
    }

    if (!permissionsResponse.success) {
        throw new Error('Error fetching permissions: ' + JSON.stringify(permissionsResponse));
    }

    // Finding a permission.
    const permissionToFind = permissionsResponse.data.find((elt) => elt.combined.includes(permission));
    if (!permissionToFind) {
        throw new Error(`No permission found: "${permission}".`);
    }

    // Fetching permissions users.
    const permissionsMembersResponse = await makeRequest({
        url: config.core.url + ':' + config.core.port + '/permissions/' + permissionToFind.id + '/members',
        token: authRequest.access_token
    });

    if (typeof permissionsMembersResponse !== 'object') {
        throw new Error('Malformed response when fetching permission members: ' + permissionsMembersResponse);
    }

    if (!permissionsMembersResponse.success) {
        throw new Error('Error fetching permission members: ' + JSON.stringify(permissionsMembersResponse));
    }

    return permissionsMembersResponse.data;
};

module.exports = {
    fetchUser,
    fetchBody,
    fetchUsersWithPermission
};
