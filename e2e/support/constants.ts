// Shared settings for the e2e stack. Service ports must match the `e2e` block
// in core/events/summeruniversity/statutory config/index.js.
export const PORTS = {
    gateway: 18080,
    core: 18084,
    events: 18085,
    summeruniversity: 18086,
    statutory: 18087,
    mailer: 18090
} as const;

export type Service = keyof typeof PORTS;

export const PASSWORD = '5ecr3t5ecr3t';

// Usernames from core/scripts/seed.js that the tests use.
export const USERS = {
    admin: 'admin',
    member: 'member',
    board: 'board',
    netcom: 'netcom',
    notMember: 'not-member'
} as const;

export type SeedUsername = typeof USERS[keyof typeof USERS];

// Users that tests create themselves (see support/core-data.ts) are prefixed with `e2e-`.
export type TestUsername = `e2e-${string}`;

export type Username = SeedUsername | TestUsername;

export const url = (service: Service): string => `http://127.0.0.1:${PORTS[service]}`;
