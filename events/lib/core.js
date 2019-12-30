const request = require('request-promise-native');

const config = require('../config');

module.exports.fetchUser = async (user, token) => {
    const userRequest = await request({
        url: config.core.url + ':' + config.core.port + '/members/' + user.user_id,
        method: 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'X-Auth-Token': token,
        },
        simple: false,
        json: true
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

module.exports.fetchBody = async (body, token) => {
    // return invalid body as it is, will catch it in Event validation.
    if (typeof body !== 'object' || typeof body.body_id !== 'number') {
        return body;
    }

    const bodyRequest = await request({
        url: config.core.url + ':' + config.core.port + '/bodies/' + body.body_id,
        method: 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'X-Auth-Token': token,
        },
        simple: false,
        json: true
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
