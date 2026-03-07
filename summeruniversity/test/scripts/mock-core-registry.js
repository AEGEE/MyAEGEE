const nock = require('nock');

const config = require('../../config');

const baseUrl = `${config.core.url}:${config.core.port}`;

const user = {
    id: 1,
    first_name: 'Summer',
    last_name: 'Tester',
    notification_email: 'summer.tester@aegee.test',
    bodies: [{ id: 1, name: 'AEGEE-Test' }]
};

exports.cleanAll = () => nock.cleanAll();

exports.mockAll = () => {
    nock.cleanAll();

    const membersStub = nock(baseUrl)
        .persist()
        .get('/members/me')
        .reply(200, { success: true, data: user });

    const permissionsStub = nock(baseUrl)
        .persist()
        .get('/my_permissions')
        .reply(200, { success: true, data: [] });

    const approvePermissionsStub = nock(baseUrl)
        .persist()
        .post('/my_permissions')
        .reply(200, { success: true, data: [] });

    return {
        membersStub,
        permissionsStub,
        approvePermissionsStub
    };
};
