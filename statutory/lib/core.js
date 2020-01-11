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

    if (options.body) {
        requestOptions.body = options.body;
    }

    if (options.qs) {
        requestOptions.qs = options.qs;
    }

    return request(requestOptions);
};

const getMember = async (req, id) => {
    const user = await makeRequest({
        url: config.core.url + ':' + config.core.port + '/members/' + id,
        token: req.headers['x-auth-token']
    });

    return user.data;
};

const getBody = async (req, id) => {
    const body = await makeRequest({
        url: config.core.url + ':' + config.core.port + '/bodies/' + id,
        token: req.headers['x-auth-token']
    });

    if (typeof body !== 'object') {
        throw new Error('Malformed response when fetching bodies: ' + body);
    }

    if (!body.success) {
        throw new Error('Error fetching body: ' + JSON.stringify(body));
    }

    return body.data;
};

const getApprovePermissions = async (req, event) => {
    // Fetching permissions for members approval, the list of bodies
    // where do you have the 'approve_members:<event_type>' permission for it.
    const approveRequest = await makeRequest({
        url: config.core.url + ':' + config.core.port + '/my_permissions',
        method: 'POST',
        token: req.headers['x-auth-token'],
        resolveWithFullResponse: true,
        body: {
            action: 'approve_members',
            object: event.type
        }
    });

    return approveRequest;
};

const getBodies = async (req) => {
    const bodies = await makeRequest({
        url: config.core.url + ':' + config.core.port + '/bodies',
        token: req.headers['x-auth-token']
    });

    return bodies.data;
};

const getMyProfile = async (req) => {
    const myProfileBody = await makeRequest({
        url: config.core.url + ':' + config.core.port + '/members/me',
        method: 'GET',
        token: req.headers['x-auth-token'],
        resolveWithFullResponse: true
    });

    return myProfileBody;
};

const getMyPermissions = async (req) => {
    const permissionsBody = await makeRequest({
        url: config.core.url + ':' + config.core.port + '/my_permissions',
        method: 'GET',
        token: req.headers['x-auth-token'],
        resolveWithFullResponse: true
    });

    return permissionsBody;
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

    if (typeof authRequest !== 'object') {
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

    if (typeof membersResponse !== 'object') {
        throw new Error('Malformed response when fetching members for permission: ' + membersResponse);
    }

    if (!membersResponse.success) {
        throw new Error('Error fetching members for permission: ' + JSON.stringify(membersResponse));
    }

    return membersResponse.data;
};

module.exports = {
    getMember,
    getBody,
    getApprovePermissions,
    getBodies,
    getMyProfile,
    getMyPermissions,
    getBodyUsersForPermission
};
