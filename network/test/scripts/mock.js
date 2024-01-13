const path = require('path');
const nock = require('nock');

const config = require('../../config');
const body = require('../assets/core-local.json').data;
const user = require('../assets/core-valid.json').data;

exports.cleanAll = () => nock.cleanAll();

exports.mockCore = (options) => {
    if (options.netError) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/members/me')
            .replyWithError('Some random error.');
    }

    if (options.badResponse) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/members/me')
            .reply(500, 'Some error happened.');
    }

    if (options.unsuccessfulResponse) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/members/me')
            .reply(500, { success: false, message: 'Some error' });
    }

    if (options.unauthorized) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/members/me')
            .replyWithFile(403, path.join(__dirname, '..', 'assets', 'core-unauthorized.json'));
    }

    return nock(`${config.core.url}:${config.core.port}`)
        .persist()
        .get('/members/me')
        .replyWithFile(200, path.join(__dirname, '..', 'assets', 'core-valid.json'));
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
            .replyWithFile(403, path.join(__dirname, '..', 'assets', 'core-unauthorized.json'));
    }

    if (options.noPermissions) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/my_permissions')
            .replyWithFile(200, path.join(__dirname, '..', 'assets', 'core-empty.json'));
    }

    return nock(`${config.core.url}:${config.core.port}`)
        .persist()
        .get('/my_permissions')
        .replyWithFile(200, path.join(__dirname, '..', 'assets', 'core-permissions-full.json'));
};

exports.mockCoreManagePermissions = (options) => {
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
            .replyWithFile(401, path.join(__dirname, '..', 'assets', 'core-unauthorized.json'));
    }

    if (options.noPermissions) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .post('/my_permissions')
            .replyWithFile(200, path.join(__dirname, '..', 'assets', 'core-empty.json'));
    }

    return nock(`${config.core.url}:${config.core.port}`)
        .persist()
        .post('/my_permissions')
        .replyWithFile(200, path.join(__dirname, '..', 'assets', 'core-manage-permissions-full.json'));
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
        .reply(200, { success: true, data: user });
};

exports.mockCoreMailer = (options) => {
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

exports.mockAll = (options = {}) => {
    nock.cleanAll();
    const omsCoreStub = exports.mockCore(options.core || {});
    const omsMainPermissionsStub = exports.mockCoreMainPermissions(options.mainPermissions || {});
    const omsManagePermissionsStub = exports.mockCoreManagePermissions(options.managePermissions || {});
    const omsCoreBodyStub = exports.mockCoreBody(options.body || {});
    const omsCoreMemberStub = exports.mockCoreMember(options.member || {});
    const omsMailerStub = exports.mockCoreMailer(options.mailer || {});

    return {
        omsCoreStub,
        omsMainPermissionsStub,
        omsManagePermissionsStub,
        omsCoreBodyStub,
        omsCoreMemberStub,
        omsMailerStub
    };
};
