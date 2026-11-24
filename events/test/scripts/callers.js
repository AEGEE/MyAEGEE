// Callers other than the superadmin of mockAll(), for permission variants in the API tests.
const { default: nock } = require('nock');

const config = require('../../config');
const mock = require('./mock-core-registry');
const superadmin = require('../assets/oms-core-valid.json').data;
const member = require('../assets/oms-core-valid-not-superadmin.json').data;

// A member without permissions: user 5, member of bodies 9, 173 and 1.
exports.member = member;

// The member, with the given global permissions (e.g. ['global:manage_event:nwm']).
exports.asMember = (combined = [], options = {}) => mock.mockAll({
    core: { notSuperadmin: true },
    mainPermissions: combined.length > 0 ? { combined } : { noPermissions: true },
    approvePermissions: { noPermissions: true },
    ...options
});

// No valid session: core answers 401 to all three requests.
exports.asAnonymous = () => mock.mockAll({
    core: { unauthorized: true },
    mainPermissions: { unauthorized: true },
    approvePermissions: { unauthorized: true }
});

// The superadmin with every permission, with `user` merged into the GET /members/me answer.
exports.asSuperadminWith = (user, options = {}) => {
    const stubs = mock.mockAll(options);
    // mockAll() registered its own /members/me first; replace it.
    nock.removeInterceptor(stubs.omscoreStub.interceptors[0]);
    nock(`${config.core.url}:${config.core.port}`)
        .persist()
        .get('/members/me')
        .reply(200, { success: true, data: { ...superadmin, ...user } });
    return stubs;
};

// Replaces the GET /members/:id answer of mockAll() (`stubs`) with the superadmin, changed by `user`.
exports.withMember = (stubs, user) => {
    nock.removeInterceptor(stubs.omsCoreMemberStub.interceptors[0]);
    nock(`${config.core.url}:${config.core.port}`)
        .persist()
        .get(/\/members\/[0-9]+/)
        .reply(200, { success: true, data: { ...superadmin, ...user } });
    return stubs;
};

// An organizer entry as the events store it.
exports.organizer = (user) => ({ user_id: user.id, first_name: 'Organizer', last_name: 'Test' });
