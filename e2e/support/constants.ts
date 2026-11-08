// Shared settings for the e2e stack. Service ports must match the `e2e` block
// in core/events/summeruniversity config/index.js.
export const PORTS = {
    gateway: 18080,
    core: 18084,
    events: 18085,
    summeruniversity: 18086,
    mailer: 18090
} as const;

export type Service = keyof typeof PORTS;

export const PASSWORD = '5ecr3t5ecr3t';

// Usernames from core/scripts/seed.js, plus the ones added by scripts/core-fixtures.ts.
export const USERS = {
    admin: 'admin',
    member: 'member',
    board: 'board',
    netcom: 'netcom',
    notMember: 'not-member',
    organizerB: 'organizer-b'
} as const;

export type Username = typeof USERS[keyof typeof USERS];

// Second antenna created by the fixtures, so tests can use an organizer
// who shares no body with the NetCom member.
export const SECOND_ANTENNA = {
    name: 'AEGEE-E2E-Second',
    code: 'EES'
} as const;

// Not part of the production config: lets regular members create a Summer University,
// so tests can check the organizer rules without manage_summeruniversity.
export const SU_CREATORS_CIRCLE = {
    name: 'E2E Summer University creators',
    permissions: ['global:create:summeruniversity'],
    members: [USERS.member]
} as const;

export const url = (service: Service): string => `http://127.0.0.1:${PORTS[service]}`;
