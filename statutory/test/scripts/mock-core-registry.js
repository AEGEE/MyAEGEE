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
            .reply(500, 'Some random error.');
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

    // A member whose application ban ends at the given moment.
    if (options.eventApplicationBanUntil) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/members/me')
            .reply(200, {
                success: true,
                data: {
                    ...regularUser,
                    event_application_ban: {
                        ban_until: options.eventApplicationBanUntil
                    }
                }
            });
    }

    if (options.eventApplicationBanned) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/members/me')
            .reply(200, {
                success: true,
                data: {
                    ...regularUser,
                    event_application_ban: {
                        ban_until: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000)
                    }
                }
            });
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
            .reply(500, 'Some random error.');
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

    if (options.applyPermissions) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/my_permissions')
            .replyWithFile(200, path.join(__dirname, '..', 'assets', 'core-permissions-apply.json'));
    }

    if (options.editBetweenDeadlinesLocalPermissions) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/my_permissions')
            .replyWithFile(200, path.join(__dirname, '..', 'assets', 'core-permissions-edit-between-deadlines-local.json'));
    }

    if (options.editBetweenDeadlinesGlobalPermissions) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/my_permissions')
            .replyWithFile(200, path.join(__dirname, '..', 'assets', 'core-permissions-edit-between-deadlines-global.json'));
    }

    if (options.incomingPermissions) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/my_permissions')
            .replyWithFile(200, path.join(__dirname, '..', 'assets', 'core-permissions-incoming.json'));
    }

    if (options.seeMemberslistsPermissions) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/my_permissions')
            .replyWithFile(200, path.join(__dirname, '..', 'assets', 'core-permissions-see-memberslists.json'));
    }

    if (options.noPermissions) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/my_permissions')
            .replyWithFile(200, path.join(__dirname, '..', 'assets', 'core-empty.json'));
    }

    // An explicit list of combined permissions, such as ['global:manage_event:agora'].
    if (options.permissions) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/my_permissions')
            .reply(200, {
                success: true,
                data: options.permissions.map((combined) => {
                    const [scope, action, object] = combined.split(':');
                    return { scope, action, object, combined };
                })
            });
    }

    if (options.applicationBanPermission) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/my_permissions')
            .reply(200, {
                success: true,
                data: [{ combined: 'global:update_application_ban:member' }]
            });
    }

    return nock(`${config.core.url}:${config.core.port}`)
        .persist()
        .get('/my_permissions')
        .replyWithFile(200, path.join(__dirname, '..', 'assets', 'core-permissions-full.json'));
};

exports.mockCoreApprovePermissions = (options) => {
    const bodyFilter = (body) => body.action === 'approve_members';

    if (options.netError) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .post('/my_permissions', bodyFilter)
            .reply(500, 'Some random error.');
    }

    if (options.badResponse) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .post('/my_permissions', bodyFilter)
            .reply(500, 'Some error happened.');
    }

    if (options.unsuccessfulResponse) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .post('/my_permissions', bodyFilter)
            .reply(500, { success: false, message: 'Some error' });
    }

    if (options.unauthorized) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .post('/my_permissions', bodyFilter)
            .replyWithFile(401, path.join(__dirname, '..', 'assets', 'core-unauthorized.json'));
    }

    if (options.noPermissions) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .post('/my_permissions', bodyFilter)
            .replyWithFile(200, path.join(__dirname, '..', 'assets', 'core-empty.json'));
    }

    return nock(`${config.core.url}:${config.core.port}`)
        .persist()
        .post('/my_permissions', bodyFilter)
        .replyWithFile(200, path.join(__dirname, '..', 'assets', 'core-approve-permissions-full.json'));
};

exports.mockCoreMemberslistPermissions = (options) => {
    const bodyFilter = (body) => body.action === 'manage_memberslist';

    if (options.netError) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .post('/my_permissions', bodyFilter)
            .reply(500, 'Some random error.');
    }

    if (options.badResponse) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .post('/my_permissions', bodyFilter)
            .reply(500, 'Some error happened.');
    }

    if (options.unsuccessfulResponse) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .post('/my_permissions', bodyFilter)
            .reply(500, { success: false, message: 'Some error' });
    }

    if (options.unauthorized) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .post('/my_permissions', bodyFilter)
            .replyWithFile(401, path.join(__dirname, '..', 'assets', 'core-unauthorized.json'));
    }

    if (options.noPermissions) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .post('/my_permissions', bodyFilter)
            .replyWithFile(200, path.join(__dirname, '..', 'assets', 'core-empty.json'));
    }

    return nock(`${config.core.url}:${config.core.port}`)
        .persist()
        .post('/my_permissions', bodyFilter)
        .replyWithFile(200, path.join(__dirname, '..', 'assets', 'core-approve-permissions-full.json'));
};

exports.mockCoreBodies = (options) => {
    if (options.netError) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/bodies')
            .reply(500, 'Some random error.');
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

    // Core knows exactly these bodies.
    if (options.data) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/bodies')
            .reply(200, { success: true, data: options.data });
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
            .reply(500, 'Some random error.');
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

    // Core does not know the body.
    if (options.notFound) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get(/^\/bodies\/[0-9a-zA-Z].*$/)
            .reply(404, { success: false, message: 'Body is not found.' });
    }

    // The user's first body, as a body of another type.
    if (options.type) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get(/^\/bodies\/[0-9].*$/)
            .reply(200, { success: true, data: { ...regularUser.bodies[0], type: options.type } });
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
            .reply(500, 'Some random error.');
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
        .reply(200, { success: true, data: options.user || regularUser });
};

exports.mockCoreMailer = (options) => {
    if (options.netError) {
        return nock(`${config.mailer.url}:${config.mailer.port}`)
            .persist()
            .post('/')
            .reply(500, 'Some random error.');
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

// Read on every call: a test can point the configuration at another host.
const conversionRateApiHost = () => config.conversion_rate_api.host;

exports.mockConversionApi = (options) => {
    if (options.netError) {
        return nock(conversionRateApiHost())
            .persist()
            .get(constants.CONVERSION_RATE_API.path)
            .reply(500, 'Some random error.');
    }

    if (options.badResponse) {
        return nock(conversionRateApiHost())
            .persist()
            .get(constants.CONVERSION_RATE_API.path)
            .reply(500, 'Some error happened.');
    }

    return nock(conversionRateApiHost())
        .persist()
        .get(constants.CONVERSION_RATE_API.path)
        .replyWithFile(200, path.join(__dirname, '..', 'assets', 'conversion-rates-api.json'));
};

exports.mockCoreLogin = (options) => {
    if (options.netError) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .post('/login')
            .reply(500, 'Some random error.');
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
            .reply(500, 'Some random error.');
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
            .reply(500, 'Some random error.');
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

    // Core refuses the lookup, as it does when the caller may not read the addresses.
    if (options.forbidden) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get(/\/members_email\?query=[0-9,].*/)
            .reply(403, { success: false, message: 'Permission global:mail:member is required, but not present.' });
    }

    // Core knows none of the users.
    if (options.empty) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get(/\/members_email\?query=[0-9,].*/)
            .reply(200, { success: true, data: [] });
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
    const memberslistPermissionsStub = exports.mockCoreMemberslistPermissions(options.memberslistPermissions || {});
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
        memberslistPermissionsStub,
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
