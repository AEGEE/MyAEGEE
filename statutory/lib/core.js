const { request } = require('./http');

const config = require('../config');

const makeRequest = (options) => {
    const requestOptions = {
        url: options.url,
        method: options.method || 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'X-Auth-Token': options.token,
            'X-Service': 'statutory'
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

// Logs in to core as the statutory service (config.core.user), for calls that have no user token,
// like the jobs that open votings. Returns the access token.
const loginAsService = async () => {
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

const getMember = async (req, id) => {
    const user = await makeRequest({
        url: config.core.url + ':' + config.core.port + '/members/' + id,
        token: req.headers['x-auth-token']
    });

    return user.data;
};

const getMails = async (req, ids) => {
    const mails = await makeRequest({
        url: config.core.url + ':' + config.core.port + '/members_email?query=' + ids,
        token: req.headers['x-auth-token']
    });

    return mails.data;
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
        fullResponse: true,
        body: {
            action: 'approve_members',
            object: event.type
        }
    });

    return approveRequest;
};

const getMemberslistPermissions = async (req, event) => {
    // Fetching permissions for memberslist management, the list of bodies
    // where do you have the 'manage_memberslist:<event_type>' permission for it.
    const memberslistRequest = await makeRequest({
        url: config.core.url + ':' + config.core.port + '/my_permissions',
        method: 'POST',
        token: req.headers['x-auth-token'],
        fullResponse: true,
        body: {
            action: 'manage_memberslist',
            object: event.type
        }
    });

    return memberslistRequest;
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
        fullResponse: true
    });

    return myProfileBody;
};

const getMyPermissions = async (req) => {
    const permissionsBody = await makeRequest({
        url: config.core.url + ':' + config.core.port + '/my_permissions',
        method: 'GET',
        token: req.headers['x-auth-token'],
        fullResponse: true
    });

    return permissionsBody;
};

const getBodyUsersForPermission = async (permission, bodyId) => {
    const accessToken = await loginAsService();

    // Fetching members.
    const membersResponse = await makeRequest({
        url: config.core.url + ':' + config.core.port + '/bodies/' + bodyId + '/members',
        token: accessToken,
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

const fetchApplicationUser = async (user) => {
    const accessToken = await loginAsService();

    // Fetching user
    const userResponse = await makeRequest({
        url: config.core.url + ':' + config.core.port + '/members/' + user,
        token: accessToken,
    });

    if (typeof userResponse !== 'object') {
        throw new Error('Malformed response when fetching user: ' + userResponse);
    }

    if (!userResponse.success) {
        throw new Error('Error fetching user: ' + JSON.stringify(userResponse));
    }

    return userResponse.data;
};

// The number of active Antennae in the network, the base of the quorum of a Pre-Agora voting.
// Contact antennae and other bodies do not count, as in the quorum page of the frontend (Stats.vue).
const countAntennae = async () => {
    const accessToken = await loginAsService();
    const bodiesResponse = await makeRequest({
        url: config.core.url + ':' + config.core.port + '/bodies',
        token: accessToken
    });

    if (typeof bodiesResponse !== 'object') {
        throw new Error('Malformed response when fetching bodies: ' + bodiesResponse);
    }

    if (!bodiesResponse.success) {
        throw new Error('Error fetching bodies: ' + JSON.stringify(bodiesResponse));
    }

    return bodiesResponse.data.filter((body) => body.type === 'antenna').length;
};

module.exports = {
    countAntennae,
    fetchApplicationUser,
    getMember,
    getMails,
    getBody,
    getApprovePermissions,
    getMemberslistPermissions,
    getBodies,
    getMyProfile,
    getMyPermissions,
    getBodyUsersForPermission
};
