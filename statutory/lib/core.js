const request = require('request-promise-native');

const config = require('../config');

module.exports.getMember = async (req, id) => {
    const user = await request({
        url: config.core.url + ':' + config.core.port + '/members/' + id,
        method: 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'X-Auth-Token': req.headers['x-auth-token'],
        },
        simple: false,
        json: true
    });

    return user.data;
};

module.exports.getBody = async (req, id) => {
    const body = await request({
        url: config.core.url + ':' + config.core.port + '/bodies/' + id,
        method: 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'X-Auth-Token': req.headers['x-auth-token'],
        },
        simple: false,
        json: true
    });

    if (typeof body !== 'object') {
        throw new Error('Malformed response when fetching bodies: ' + body);
    }

    if (!body.success) {
        throw new Error('Error fetching body: ' + JSON.stringify(body));
    }

    return body.data;
};

module.exports.getApprovePermissions = async (req, event) => {
    // Fetching permissions for members approval, the list of bodies
    // where do you have the 'approve_members:<event_type>' permission for it.
    const approveRequest = await request({
        url: config.core.url + ':' + config.core.port + '/my_permissions',
        method: 'POST',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'X-Auth-Token': req.headers['x-auth-token'],
        },
        simple: false,
        json: true,
        resolveWithFullResponse: true,
        body: {
            action: 'approve_members',
            object: event.type
        }
    });

    return approveRequest;
};

module.exports.getBodies = async (req) => {
    const bodies = await request({
        url: config.core.url + ':' + config.core.port + '/bodies',
        method: 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'X-Auth-Token': req.headers['x-auth-token'],
        },
        simple: false,
        json: true
    });

    return bodies.data;
};

module.exports.getMyProfile = async (req) => {
    const myProfileBody = await request({
        url: config.core.url + ':' + config.core.port + '/members/me',
        method: 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'X-Auth-Token': req.headers['x-auth-token'],
        },
        resolveWithFullResponse: true,
        simple: false,
        json: true,
    });

    return myProfileBody;
};

module.exports.getMyPermissions = async (req) => {
    const permissionsBody = await request({
        url: config.core.url + ':' + config.core.port + '/my_permissions',
        method: 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'X-Auth-Token': req.headers['x-auth-token'],
        },
        resolveWithFullResponse: true,
        simple: false,
        json: true,
    });

    return permissionsBody;
};
