const path = require('path');
const { default: nock } = require('nock');

const config = require('../../config');
const regularUser = require('../assets/oms-core-valid.json').data;
const body = require('../assets/oms-core-body.json').data;

const coreUrl = `${config.core.url}:${config.core.port}`;
const mailerUrl = `${config.mailer.url}:${config.mailer.port}`;
const asset = (name) => path.join(__dirname, '..', 'assets', name);

exports.cleanAll = () => nock.cleanAll();

// Every mock accepts the same failure options:
// - netError / badResponse: HTTP 500 with a non-JSON body
// - unsuccessfulResponse: HTTP 500 with { success: false }
// - emptyResponse: HTTP 200 with an empty body
// - unauthorized: HTTP 401 (only meaningful for the auth-related endpoints)
// - notFound / forbidden: HTTP 404 / 403 with { success: false } (core's answers for an unknown or a deleted body)
// - noPermissions: HTTP 200 with an empty data array (permission endpoints)
// - data: HTTP 200 with { success: true, data } (custom payload)
// - delay: answer after this many milliseconds
// Otherwise the default reply is used.
const intercept = (baseUrl, method, endpoint, options, defaultReply) => {
    let interceptor = nock(baseUrl).persist()[method](endpoint);
    if (endpoint instanceof RegExp) {
        interceptor = interceptor.query(true);
    }

    // Answers after this many milliseconds, e.g. a slow mailer.
    if (options.delay) {
        interceptor = interceptor.delay(options.delay);
    }

    if (options.netError) {
        return interceptor.reply(500, 'Some random error.');
    }

    if (options.badResponse) {
        return interceptor.reply(500, 'Some error happened.');
    }

    if (options.unsuccessfulResponse) {
        return interceptor.reply(500, { success: false, message: 'Some error' });
    }

    if (options.emptyResponse) {
        return interceptor.reply(200, '');
    }

    if (options.unauthorized) {
        return interceptor.replyWithFile(401, asset('oms-core-unauthorized.json'));
    }

    if (options.notFound) {
        return interceptor.reply(404, { success: false, message: 'Not found.' });
    }

    if (options.forbidden) {
        return interceptor.reply(403, { success: false, message: 'Not allowed.' });
    }

    if (options.noPermissions) {
        return interceptor.replyWithFile(200, asset('oms-core-empty.json'));
    }

    if (typeof options.data !== 'undefined') {
        return interceptor.reply(200, { success: true, data: options.data });
    }

    return defaultReply(interceptor);
};

// Converts a list of combined permissions (e.g. 'global:apply:summeruniversity')
// to the format returned by core's GET /my_permissions.
exports.permissionsList = (combinedList) => combinedList.map((combined, index) => {
    const [scope, action, object] = combined.split(':');
    return { id: index + 1, scope, action, object, combined, filters: [] };
});

exports.mockCore = (options) => {
    if (options.notSuperadmin) {
        return intercept(coreUrl, 'get', '/members/me', {}, (i) => i.replyWithFile(200, asset('oms-core-valid-not-superadmin.json')));
    }

    if (options.eventApplicationBanned) {
        return intercept(coreUrl, 'get', '/members/me', {
            data: {
                ...regularUser,
                event_application_ban: { ban_until: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000) }
            }
        });
    }

    if (options.expiredApplicationBan) {
        return intercept(coreUrl, 'get', '/members/me', {
            data: {
                ...regularUser,
                event_application_ban: { ban_until: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            }
        });
    }

    return intercept(coreUrl, 'get', '/members/me', options, (i) => i.replyWithFile(200, asset('oms-core-valid.json')));
};

// GET /my_permissions: the global permissions of the user.
// Pass `permissions: [...]` with combined permission strings for a custom set.
exports.mockCoreMainPermissions = (options) => {
    const opts = Array.isArray(options.permissions)
        ? { data: exports.permissionsList(options.permissions) }
        : options;
    return intercept(coreUrl, 'get', '/my_permissions', opts, (i) => i.replyWithFile(200, asset('oms-core-permissions-full.json')));
};

// POST /my_permissions: the bodies where the user has approve_members:summeruniversity.
exports.mockCoreApprovePermissions = (options) => intercept(coreUrl, 'post', '/my_permissions', options, (i) => i.replyWithFile(200, asset('oms-core-approve-permissions-full.json')));

// GET /members/:id
// Pass `bodiesById: { [userId]: [bodyId, ...] }` to reply with the requested user and these
// bodies (users that aren't listed keep the bodies of the default user).
exports.mockCoreMember = (options) => {
    if (options.bodiesById) {
        return nock(coreUrl).persist().get(/^\/members\/[0-9]+/).query(true)
            .reply((mockRequest) => {
                const uri = new URL(mockRequest.url).pathname;
                const id = Number(uri.match(/^\/members\/([0-9]+)/)[1]);
                const bodyIds = options.bodiesById[id];
                const bodies = bodyIds ? bodyIds.map((bodyId) => ({ ...body, id: bodyId })) : regularUser.bodies;
                return [200, { success: true, data: { ...regularUser, id, bodies } }];
            });
    }

    return intercept(coreUrl, 'get', /^\/members\/[0-9]+/, options, (i) => i.reply(200, { success: true, data: regularUser }));
};

// GET /bodies/:id/members - board members to notify about applications.
// Registered before the generic /bodies/:id mock so that nock matches it first.
exports.mockCoreBodyMembers = (options) => intercept(coreUrl, 'get', /^\/bodies\/[0-9]+\/members/, options, (i) => i.replyWithFile(200, asset('oms-core-body-members.json')));

// GET /bodies/:id
// Pass `echoId: true` to reply with the requested body id instead of the default body's.
exports.mockCoreBody = (options) => {
    if (options.echoId) {
        return nock(coreUrl).persist().get(/^\/bodies\/[0-9]+$/).query(true)
            .reply((mockRequest) => {
                const uri = new URL(mockRequest.url).pathname;
                const id = Number(uri.match(/^\/bodies\/([0-9]+)/)[1]);
                return [200, { success: true, data: { ...body, id } }];
            });
    }

    return intercept(coreUrl, 'get', /^\/bodies\/[0-9]+$/, options, (i) => i.reply(200, { success: true, data: body }));
};

// POST /login - used to get the admin token.
exports.mockCoreLogin = (options) => intercept(coreUrl, 'post', '/login', options, (i) => i.reply(200, { success: true, access_token: '1', refresh_token: '1' }));

exports.mockMailer = (options) => intercept(mailerUrl, 'post', '/', options, (i) => i.reply(200, { success: true }));

exports.mockAll = (options = {}) => {
    nock.cleanAll();

    return {
        omscoreStub: exports.mockCore(options.core || {}),
        omsMainPermissionsStub: exports.mockCoreMainPermissions(options.mainPermissions || {}),
        omsApprovePermissionsStub: exports.mockCoreApprovePermissions(options.approvePermissions || {}),
        omsCoreMemberStub: exports.mockCoreMember(options.member || {}),
        omsCoreBodyMembersStub: exports.mockCoreBodyMembers(options.bodyMembers || {}),
        omsCoreBodyStub: exports.mockCoreBody(options.body || {}),
        omsCoreLoginStub: exports.mockCoreLogin(options.login || {}),
        omsMailerStub: exports.mockMailer(options.mailer || {})
    };
};

// Collects the request bodies (parsed as JSON) of all the requests to the given stub.
exports.captureRequests = (stub) => {
    const bodies = [];
    stub.on('request', (req, interceptor, requestBody) => bodies.push(JSON.parse(requestBody)));
    return bodies;
};

// Collects the bodies of all the mails sent through the given mailer stub.
exports.captureMails = (mailerStub) => {
    const mails = [];
    mailerStub.on('request', (req, interceptor, requestBody) => mails.push(JSON.parse(requestBody)));
    return mails;
};
