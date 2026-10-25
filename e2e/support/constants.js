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

// Circle permissions as configured on production (2026-10-25). The fixtures
// replace the seeded permissions of these circles with exactly these lists.
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
        'global:manage_network:netcom_assignment'
    ],
    'General members circle': [
        'local:view_members:circle',
        'global:join:circle',
        'local:view_members:body',
        'local:view:member',
        'global:create:event',
        'global:search:member',
        'global:apply:summeruniversity'
    ]
};

const url = (service) => `http://localhost:${PORTS[service]}`;

module.exports = {
    PORTS,
    PASSWORD,
    USERS,
    SECOND_ANTENNA,
    PROD_CIRCLE_PERMISSIONS,
    url
};
