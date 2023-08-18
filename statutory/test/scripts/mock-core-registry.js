const path = require('path');
const nock = require('nock');

const config = require('../../config');
const regularUser = require('../assets/core-valid.json').data;
const constants = require('../../lib/constants');

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
            .replyWithFile(401, path.join(__dirname, '..', 'assets', 'core-unauthorized.json'));
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
            .replyWithFile(401, path.join(__dirname, '..', 'assets', 'core-unauthorized.json'));
    }

    if (options.latePermissions) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/my_permissions')
            .replyWithFile(200, path.join(__dirname, '..', 'assets', 'core-permissions-late.json'));
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
        .replyWithFile(200, path.join(__dirname, '..', 'assets', 'core-approve-permissions-full.json'));
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
            .replyWithFile(403, path.join(__dirname, '..', 'assets', 'core-unauthorized.json'));
    }

    if (options.empty) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/members')
            .replyWithFile(200, path.join(__dirname, '..', 'assets', 'core-empty.json'));
    }

    return nock(`${config.core.url}:${config.core.port}`)
        .persist()
        .get('/members')
        .replyWithFile(200, path.join(__dirname, '..', 'assets', 'core-members.json'));
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
            .replyWithFile(403, path.join(__dirname, '..', 'assets', 'core-unauthorized.json'));
    }

    if (options.empty) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/bodies')
            .replyWithFile(200, path.join(__dirname, '..', 'assets', 'core-empty.json'));
    }

    return nock(`${config.core.url}:${config.core.port}`)
        .persist()
        .get('/bodies')
        .replyWithFile(200, path.join(__dirname, '..', 'assets', 'core-bodies.json'));
};

exports.mockCoreBody = (options) => {
    if (options.netError) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get(/^\/bodies\/[0-9].*$/)
            .replyWithError('Some random error.');
    }

    if (options.badResponse) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get(/^\/bodies\/[0-9].*$/)
            .reply(500, 'Some error happened.');
    }

    if (options.unsuccessfulResponse) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get(/^\/bodies\/[0-9].*$/)
            .reply(500, { success: false, message: 'Some error' });
    }

    if (options.type) {
        const body = regularUser.bodies[0];
        body.type = options.type;

        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get(/^\/bodies\/[0-9].*$/)
            .reply(500, { success: true, data: body });
    }

    return nock(`${config.core.url}:${config.core.port}`)
        .persist()
        .get(/^\/bodies\/[0-9].*$/)
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

exports.mockConversionApi = (options) => {
    if (options.netError) {
        return nock(constants.CONVERSION_RATE_API.host)
            .persist()
            .get(constants.CONVERSION_RATE_API.path)
            .replyWithError('Some random error.');
    }

    if (options.badResponse) {
        return nock(constants.CONVERSION_RATE_API.host)
            .persist()
            .get(constants.CONVERSION_RATE_API.path)
            .reply(500, 'Some error happened.');
    }

    return nock(constants.CONVERSION_RATE_API.host)
        .persist()
        .get(constants.CONVERSION_RATE_API.path)
        .replyWithFile(200, path.join(__dirname, '..', 'assets', 'conversion-rates-api.json'));
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

exports.mockCoreBodyMembers = (options) => {
    if (options.netError) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get(/\/bodies\/[0-9].*\/members/)
            .replyWithError('Some random error.');
    }

    if (options.badResponse) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get(/\/bodies\/[0-9].*\/members/)
            .reply(500, 'Some error happened.');
    }

    if (options.unsuccessfulResponse) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get(/\/bodies\/[0-9].*\/members/)
            .reply(500, { success: false, message: 'Some error' });
    }

    if (options.unauthorized) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get(/\/bodies\/[0-9].*\/members/)
            .replyWithFile(403, path.join(__dirname, '..', 'assets', 'core-unauthorized.json'));
    }

    if (options.empty) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get(/\/bodies\/[0-9].*\/members/)
            .replyWithFile(200, path.join(__dirname, '..', 'assets', 'core-empty.json'));
    }

    return nock(`${config.core.url}:${config.core.port}`)
        .persist()
        .get(/\/bodies\/[0-9].*\/members/)
        .replyWithFile(200, path.join(__dirname, '..', 'assets', 'core-body-members.json'));
};

exports.mockCoreMails = (options) => {
    if (options.netError) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get(/\/members_email\?query=[0-9,].*/)
            .replyWithError('Some random error.');
    }

    if (options.badResponse) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get(/\/members_email\?query=[0-9,].*/)
            .reply(500, 'Some error happened.');
    }

    if (options.unsuccessfulResponse) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get(/\/members_email\?query=[0-9,].*/)
            .reply(500, { success: false, message: 'Some error' });
    }

    return nock(`${config.core.url}:${config.core.port}`)
        .persist()
        .get(/\/members_email\?query=[0-9,].*/)
        .replyWithFile(200, path.join(__dirname, '..', 'assets', 'core-notification-mails.json'));
};

exports.mockAll = (options = {}) => {
    nock.cleanAll();
    const coreStub = exports.mockCore(options.core || {});
    const mainPermissionsStub = exports.mockCoreMainPermissions(options.mainPermissions || {});
    const approvePermissionsStub = exports.mockCoreApprovePermissions(options.approvePermissions || {});
    const coreMembersStub = exports.mockCoreMembers(options.members || {});
    const coreBodyMembersStub = exports.mockCoreBodyMembers(options.bodyMembers || {});
    const coreBodiesStub = exports.mockCoreBodies(options.bodies || {});
    const coreBodyStub = exports.mockCoreBody(options.body || {});
    const coreMemberStub = exports.mockCoreMember(options.member || {});
    const coreLoginStub = exports.mockCoreLogin(options.login || {});
    const coreMailsStub = exports.mockCoreMails(options.mails || {});
    const mailerStub = exports.mockCoreMailer(options.mailer || {});
    const conversionRatesStub = exports.mockConversionApi(options.conversion || {});

    return {
        coreStub,
        mainPermissionsStub,
        approvePermissionsStub,
        coreMembersStub,
        coreBodiesStub,
        coreBodyStub,
        coreMemberStub,
        coreLoginStub,
        coreBodyMembersStub,
        mailerStub,
        coreMailsStub,
        conversionRatesStub
    };
};
