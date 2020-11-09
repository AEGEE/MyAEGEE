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
