// Shared settings for the e2e stack. Service ports must match the `e2e` block
// in core/events/summeruniversity config/index.js.
const PORTS = {
    gateway: 18080,
    core: 18084,
    events: 18085,
    summeruniversity: 18086,
    mailer: 18090
};

const PASSWORD = '5ecr3t5ecr3t';

// Usernames from core/scripts/seed.js, plus the ones added by scripts/core-fixtures.js.
const USERS = {
    admin: 'admin',
    member: 'member',
    board: 'board',
    netcom: 'netcom',
    notMember: 'not-member',
    organizerB: 'organizer-b'
};

// Second antenna created by the fixtures, so tests can use an organizer
// who shares no body with the NetCom member.
const SECOND_ANTENNA = {
    name: 'AEGEE-E2E-Second',
    code: 'EES'
};

// Circle permissions as configured on production (2026-10-25), including the
// planned change from the scoped member search: global:search:member moves from
// the general members circle to NetCom (boards keep it through their board circles).
// The fixtures replace the seeded permissions of these circles with exactly these lists.
const PROD_CIRCLE_PERMISSIONS = {
    'Network Commission': [
        'global:view_members:circle',
        'global:add_member:circle',
        'global:update:body',
        'global:view_members:body',
        'global:view:join_request',
        'global:process:join_request',
        'global:approve_event:nwm',
        'global:manage_event:nwm',
        'global:see_memberslists:agora',
        'global:manage_network:boards',
        'global:view:board',
        'global:see_missing_memberslists:agora',
        'global:see_memberslists_without_fee:agora',
        'global:manage_network:antenna_criteria',
        'global:manage_network:communication',
        'global:manage_network:netcom_assignment',
        'global:search:member'
    ],
    'General members circle': [
        'local:view_members:circle',
        'global:join:circle',
        'local:view_members:body',
        'local:view:member',
        'global:create:event',
        'global:apply:summeruniversity'
    ]
};

// Not part of the production config: lets regular members create a Summer University,
// so tests can check the organizer rules without manage_summeruniversity.
const SU_CREATORS_CIRCLE = {
    name: 'E2E Summer University creators',
    permissions: ['global:create:summeruniversity'],
    members: [USERS.member]
};

const url = (service) => `http://127.0.0.1:${PORTS[service]}`;

module.exports = {
    PORTS,
    PASSWORD,
    USERS,
    SECOND_ANTENNA,
    PROD_CIRCLE_PERMISSIONS,
    SU_CREATORS_CIRCLE,
    url
};
