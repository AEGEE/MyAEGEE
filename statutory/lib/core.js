const crypto = require('crypto');

const { request } = require('./http');
const createTtlCache = require('./ttl_cache');

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

// The vote route only needs to know who the user is. A delegate usually loads the voting
// and then submits a vote within seconds, so the profile is kept for a short time per token.
// Only successful answers are kept, so a failed or unauthorized login is asked again every time.
// A token that core revokes stays usable for the vote route for at most these 30 seconds.
const profileCache = createTtlCache({ ttlMs: 30 * 1000, maxSize: 10000 });

const getMyProfileCached = async (req) => {
    const key = crypto.createHash('sha256').update(String(req.headers['x-auth-token'])).digest('hex');
    const cached = profileCache.get(key);
    if (cached) {
        return cached;
    }

    const response = await getMyProfile(req);
    if (response.statusCode === 200 && response.body && response.body.success) {
        profileCache.set(key, response);
    }

    return response;
};

const clearProfileCache = () => profileCache.clear();

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

module.exports = {
    fetchApplicationUser,
    getMember,
    getMails,
    getBody,
    getApprovePermissions,
    getMemberslistPermissions,
    getBodies,
    getMyProfile,
    getMyProfileCached,
    clearProfileCache,
    getMyPermissions,
    getBodyUsersForPermission
};
