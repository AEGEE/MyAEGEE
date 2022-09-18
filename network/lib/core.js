const request = require('request-promise-native');

const config = require('../config');

module.exports.getMyProfile = async (req) => {
    const myProfileBody = await request({
        url: config.core.url + ':' + config.core.port + '/members/me',
        method: 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'X-Auth-Token': req.headers['x-auth-token'],
            'X-Service': 'network'
        },
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
            'X-Service': 'network'
        },
        simple: false,
        json: true,
    });

    return permissionsBody;
};

const makeRequest = (options) => {
    const requestOptions = {
        url: options.url,
        method: options.method || 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'X-Auth-Token': options.token,
            'X-Service': 'network'
        },
        simple: false,
        json: true,
        resolveWithFullResponse: options.resolveWithFullResponse || false
    };

    return request(requestOptions);
};

module.exports.fetchBody = async (body, token) => {
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

module.exports.fetchUser = async (user, token) => {
    const userRequest = await makeRequest({
        url: config.core.url + ':' + config.core.port + '/members/' + user,
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
        first_name: userRequest.data.first_name,
        last_name: userRequest.data.last_name,
        name: userRequest.data.first_name + ' ' + userRequest.data.last_name
    };
};
