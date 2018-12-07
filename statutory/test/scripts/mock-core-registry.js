const nock = require('nock');
const path = require('path');

const config = require('../../config');
const regularUser = require('../assets/oms-core-valid').data;

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
            .replyWithFile(200, path.join(__dirname, '..', 'assets', 'oms-core-empty.json'));
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
            .replyWithFile(403, path.join(__dirname, '..', 'assets', 'oms-core-unauthorized.json'));
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

exports.mockCoreMembers = (options) => {
    if (options.netError) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/members')
            .replyWithError('Some random error.');
    }

    if (options.badResponse) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/members')
            .reply(500, 'Some error happened.');
    }

    if (options.unsuccessfulResponse) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/members')
            .reply(500, { success: false, message: 'Some error' });
    }

    if (options.unauthorized) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/members')
            .replyWithFile(403, path.join(__dirname, '..', 'assets', 'oms-core-unauthorized.json'));
    }

    if (options.empty) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/members')
            .replyWithFile(200, path.join(__dirname, '..', 'assets', 'oms-core-empty.json'));
    }

    return nock(`${config.core.url}:${config.core.port}`)
        .persist()
        .get('/members')
        .replyWithFile(200, path.join(__dirname, '..', 'assets', 'oms-core-members.json'));
};

exports.mockCoreBodies = (options) => {
    if (options.netError) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/bodies')
            .replyWithError('Some random error.');
    }

    if (options.badResponse) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/bodies')
            .reply(500, 'Some error happened.');
    }

    if (options.unsuccessfulResponse) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/bodies')
            .reply(500, { success: false, message: 'Some error' });
    }

    if (options.unauthorized) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/bodies')
            .replyWithFile(403, path.join(__dirname, '..', 'assets', 'oms-core-unauthorized.json'));
    }

    if (options.empty) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/bodies')
            .replyWithFile(200, path.join(__dirname, '..', 'assets', 'oms-core-empty.json'));
    }

    return nock(`${config.core.url}:${config.core.port}`)
        .persist()
        .get('/bodies')
        .replyWithFile(200, path.join(__dirname, '..', 'assets', 'oms-core-bodies.json'));
};

exports.mockCoreBody = (options) => {
    if (options.netError) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/bodies/' + regularUser.bodies[0].id)
            .replyWithError('Some random error.');
    }

    if (options.badResponse) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/bodies/' + regularUser.bodies[0].id)
            .reply(500, 'Some error happened.');
    }

    if (options.unsuccessfulResponse) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/bodies/' + regularUser.bodies[0].id)
            .reply(500, { success: false, message: 'Some error' });
    }

    return nock(`${config.core.url}:${config.core.port}`)
        .persist()
        .get('/bodies/' + regularUser.bodies[0].id)
        .reply(200, { success: true, data: regularUser.bodies[0] });
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
    const omsApprovePermissionsStub = exports.mockCoreApprovePermissions(options.approvePermissions || {});
    const omsCoreMembersStub = exports.mockCoreMembers(options.members || {});
    const omsCoreBodiesStub = exports.mockCoreBodies(options.bodies || {});
    const omsCoreBodyStub = exports.mockCoreBody(options.body || {});
    const omsCoreMemberStub = exports.mockCoreMember(options.member || {});
    const omsMailerStub = exports.mockCoreMailer(options.mailer || {});

    return {
        omsCoreStub,
        omsMainPermissionsStub,
        omsApprovePermissionsStub,
        omsCoreMembersStub,
        omsCoreBodiesStub,
        omsCoreBodyStub,
        omsCoreMemberStub,
        omsMailerStub
    };
};
