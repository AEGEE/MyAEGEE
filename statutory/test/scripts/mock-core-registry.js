const nock = require('nock');
const path = require('path');

const config = require('../../config');

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
            .replyWithFile(403, path.join(__dirname, '..', 'assets', 'oms-core-unauthorized.json'));
    }

    return nock(`${config.core.url}:${config.core.port}`)
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
            .replyWithFile(403, path.join(__dirname, '..', 'assets', 'oms-core-unauthorized.json'));
    }

    if (options.noPermissions) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/my_permissions')
            .replyWithFile(200, path.join(__dirname, '..', 'assets', 'oms-core-permissions-empty.json'));
    }

    return nock(`${config.core.url}:${config.core.port}`)
        .persist()
        .get('/my_permissions')
        .replyWithFile(200, path.join(__dirname, '..', 'assets', 'oms-core-permissions-full.json'));
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
            .replyWithFile(403, path.join(__dirname, '..', 'assets', 'oms-core-unauthorized.json'));
    }

    if (options.noPermissions) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/my_permissions')
            .replyWithFile(200, path.join(__dirname, '..', 'assets', 'oms-core-permissions-empty.json'));
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
            .replyWithFile(403, path.join(__dirname, '..', 'assets', 'oms-core-unauthorized.json'));
    }

    if (options.noPermissions) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .post('/my_permissions')
            .replyWithFile(200, path.join(__dirname, '..', 'assets', 'oms-core-permissions-empty.json'));
    }

    return nock(`${config.core.url}:${config.core.port}`)
        .persist()
        .post('/my_permissions')
        .replyWithFile(200, path.join(__dirname, '..', 'assets', 'oms-core-approve-permissions-full.json'));
};

exports.mockAll = (options = {}) => {
    nock.cleanAll();
    const omsCoreStub = exports.mockCore(options.core || {});
    const omsMainPermissionsStub = exports.mockCoreMainPermissions(options.mainPermissions || {});
    const omsApprovePermissionsStub = exports.mockCoreApprovePermissions(options.approvePermissions || {});

    return {
        omsCoreStub,
        omsMainPermissionsStub,
        omsApprovePermissionsStub
    };
};
