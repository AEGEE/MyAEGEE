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
        last_name: userRequest.data.last_name
    };
};
