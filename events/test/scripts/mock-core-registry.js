const nock = require('nock');
const path = require('path');

const config = require('../../config');
const regularUser = require('../assets/oms-core-valid.json').data;
const body = require('../assets/oms-core-body.json').data;

exports.cleanAll = () => nock.cleanAll();

exports.mockCore = (options) => {
    if (options.netError) {
        return nock(config.core.url + ':' + config.core.port)
            .persist()
            .get('/members/me')
            .replyWithError('Some random error.');
    }

    if (options.badResponse) {
        return nock(config.core.url + ':' + config.core.port)
            .persist()
            .get('/members/me')
            .reply(500, 'Some error happened.');
    }

    if (options.unsuccessfulResponse) {
        return nock(config.core.url + ':' + config.core.port)
            .persist()
            .get('/members/me')
            .reply(500, { success: false, message: 'Some error' });
    }

    if (options.unauthorized) {
        return nock(config.core.url + ':' + config.core.port)
            .persist()
            .get('/members/me')
            .replyWithFile(401, path.join(__dirname, '..', 'assets', 'oms-core-unauthorized.json'));
    }

    if (options.notSuperadmin) {
        return nock(config.core.url + ':' + config.core.port)
            .persist()
            .get('/members/me')
            .replyWithFile(200, path.join(__dirname, '..', 'assets', 'oms-core-valid-not-superadmin.json'));
    }

    return nock(config.core.url + ':' + config.core.port)
        .persist()
        .get('/members/me')
        .replyWithFile(200, path.join(__dirname, '..', 'assets', 'oms-core-valid.json'));
};

exports.mockCoreMainPermissions = (options) => {
    if (options.netError) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/my_permissions')
            .replyWithError('Some random error.');
    }

    if (options.badResponse) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/my_permissions')
            .reply(500, 'Some error happened.');
    }

    if (options.unsuccessfulResponse) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/my_permissions')
            .reply(500, { success: false, message: 'Some error' });
    }

    if (options.unauthorized) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/my_permissions')
            .replyWithFile(401, path.join(__dirname, '..', 'assets', 'oms-core-unauthorized.json'));
    }

    if (options.noPermissions) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/my_permissions')
            .replyWithFile(200, path.join(__dirname, '..', 'assets', 'oms-core-empty.json'));
    }

    return nock(`${config.core.url}:${config.core.port}`)
        .persist()
        .get('/my_permissions')
        .replyWithFile(200, path.join(__dirname, '..', 'assets', 'oms-core-permissions-full.json'));
};

exports.mockCoreApprovePermissions = (options) => {
    if (options.netError) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .post('/my_permissions')
            .replyWithError('Some random error.');
    }

    if (options.badResponse) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .post('/my_permissions')
            .reply(500, 'Some error happened.');
    }

    if (options.unsuccessfulResponse) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .post('/my_permissions')
            .reply(500, { success: false, message: 'Some error' });
    }

    if (options.unauthorized) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .post('/my_permissions')
            .replyWithFile(401, path.join(__dirname, '..', 'assets', 'oms-core-unauthorized.json'));
    }

    if (options.noPermissions) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .post('/my_permissions')
            .replyWithFile(200, path.join(__dirname, '..', 'assets', 'oms-core-empty.json'));
    }

    return nock(`${config.core.url}:${config.core.port}`)
        .persist()
        .post('/my_permissions')
        .replyWithFile(200, path.join(__dirname, '..', 'assets', 'oms-core-approve-permissions-full.json'));
};

exports.mockCoreMember = (options) => {
    if (options.netError) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get(/\/members\/[0-9].*/)
            .replyWithError('Some random error.');
    }

    if (options.badResponse) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get(/\/members\/[0-9].*/)
            .reply(500, 'Some error happened.');
    }

    if (options.unsuccessfulResponse) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get(/\/members\/[0-9].*/)
            .reply(500, { success: false, message: 'Some error' });
    }

    return nock(`${config.core.url}:${config.core.port}`)
        .persist()
        .get(/\/members\/[0-9].*/)
        .reply(200, { success: true, data: regularUser });
};

exports.mockCoreBody = (options) => {
    if (options.netError) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get(/\/bodies\/[0-9].*/)
            .replyWithError('Some random error.');
    }

    if (options.badResponse) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get(/\/bodies\/[0-9].*/)
            .reply(500, 'Some error happened.');
    }

    if (options.unsuccessfulResponse) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get(/\/bodies\/[0-9].*/)
            .reply(500, { success: false, message: 'Some error' });
    }

    return nock(`${config.core.url}:${config.core.port}`)
        .persist()
        .get(/\/bodies\/[0-9].*/)
        .reply(200, { success: true, data: body });
};

exports.mockMailer = (options) => {
    if (options.netError) {
        return nock(`${config.mailer.url}:${config.mailer.port}`)
            .persist()
            .post('/')
            .replyWithError('Some random error.');
    }

    if (options.badResponse) {
        return nock(`${config.mailer.url}:${config.mailer.port}`)
            .persist()
            .post('/')
            .reply(500, 'Some error happened.');
    }

    if (options.unsuccessfulResponse) {
        return nock(`${config.mailer.url}:${config.mailer.port}`)
            .persist()
            .post('/')
            .reply(500, { success: false, message: 'Some error' });
    }

    return nock(`${config.mailer.url}:${config.mailer.port}`)
        .persist()
        .post('/')
        .reply(200, { success: true });
};

exports.mockCoreLogin = (options) => {
    if (options.netError) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .post('/login')
            .replyWithError('Some random error.');
    }

    if (options.badResponse) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .post('/login')
            .reply(500, 'Some error happened.');
    }

    if (options.unsuccessfulResponse) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .post('/login')
            .reply(500, { success: false, message: 'Some error' });
    }

    return nock(`${config.core.url}:${config.core.port}`)
        .persist()
        .post('/login')
        .reply(200, { success: true, access_token: '1', refresh_token: '1' });
};

exports.mockCorePermissions = (options) => {
    if (options.netError) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/permissions')
            .replyWithError('Some random error.');
    }

    if (options.badResponse) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/permissions')
            .reply(500, 'Some error happened.');
    }

    if (options.unsuccessfulResponse) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/permissions')
            .reply(500, { success: false, message: 'Some error' });
    }

    if (options.unauthorized) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/permissions')
            .replyWithFile(401, path.join(__dirname, '..', 'assets', 'oms-core-unauthorized.json'));
    }

    if (options.noPermissions) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/permissions')
            .replyWithFile(200, path.join(__dirname, '..', 'assets', 'oms-core-empty.json'));
    }

    return nock(`${config.core.url}:${config.core.port}`)
        .persist()
        .get('/permissions')
        .replyWithFile(200, path.join(__dirname, '..', 'assets', 'oms-core-permissions-full.json'));
};

exports.mockCorePermissionMembers = (options) => {
    if (options.netError) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get(/\/permissions\/[0-9].*\/members/)
            .replyWithError('Some random error.');
    }

    if (options.badResponse) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get(/\/permissions\/[0-9].*\/members/)
            .reply(500, 'Some error happened.');
    }

    if (options.unsuccessfulResponse) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get(/\/permissions\/[0-9].*\/members/)
            .reply(500, { success: false, message: 'Some error' });
    }

    return nock(`${config.core.url}:${config.core.port}`)
        .persist()
        .get(/\/permissions\/[0-9].*\/members/)
        .replyWithFile(200, path.join(__dirname, '..', 'assets', 'oms-core-permissions-members.json'));
};

exports.mockAll = (options = {}) => {
    nock.cleanAll();
    const omscoreStub = exports.mockCore(options.core || {});
    const omsPermissionsStub = exports.mockCorePermissions(options.permissions || {});
    const omsMainPermissionsStub = exports.mockCoreMainPermissions(options.mainPermissions || {});
    const omsApprovePermissionsStub = exports.mockCoreApprovePermissions(options.approvePermissions || {});
    const omsCoreMemberStub = exports.mockCoreMember(options.member || {});
    const omsCoreBodyStub = exports.mockCoreBody(options.body || {});
    const omsCoreLoginStub = exports.mockCoreLogin(options.login || {});
    const omsCorePermissionMembersStub = exports.mockCorePermissionMembers(options.permissionMembers || {});
    const omsMailerStub = exports.mockMailer(options.mailer || {});

    return {
        omscoreStub,
        omsPermissionsStub,
        omsMainPermissionsStub,
        omsApprovePermissionsStub,
        omsCoreMemberStub,
        omsCoreBodyStub,
        omsCoreLoginStub,
        omsCorePermissionMembersStub,
        omsMailerStub
    };
};
