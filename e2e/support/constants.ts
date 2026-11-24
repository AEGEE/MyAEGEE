// Shared settings for the e2e stack: the ports, and what each service is started with.
//
// E2E_SLOT=n (0 to 9, default 0) moves every port by n * 1000 and gives the databases and
// media folders a suffix, so several checkouts can run their stacks on one machine at the
// same time. The services read the values below in the `e2e` block of their config/index.js,
// with slot 0's values as fallback.
const slot = process.env.E2E_SLOT || '0';
if (!/^[0-9]$/.test(slot)) {
    throw new Error(`E2E_SLOT must be an integer from 0 to 9, got "${slot}".`);
}

export const SLOT = Number(slot);

const BASE_PORTS = {
    gateway: 18080,
    core: 18084,
    events: 18085,
    summeruniversity: 18086,
    statutory: 18087,
    network: 18088,
    discounts: 18089,
    mailer: 18090,
    // The stand-in for the currency conversion rates statutory asks for (support/fake-currency.ts).
    currency: 18091,
    // The static server of the mocked-API suite.
    mocked: 18180
} as const;

export type Service = keyof typeof BASE_PORTS;

export const PORTS = Object.fromEntries(
    Object.entries(BASE_PORTS).map(([name, port]) => [name, port + SLOT * 1000])
) as Record<Service, number>;

const suffix = SLOT ? `-s${SLOT}` : '';

// The environment a service runs with, also for its `sequelize db:*` commands and the seed.
export const serviceEnv = (service: Service): Record<string, string> => ({
    NODE_ENV: 'e2e',
    LOGLEVEL: process.env.LOGLEVEL || 'warn',
    E2E_PORT: String(PORTS[service]),
    E2E_DB_NAME: `${service}-e2e${suffix}`,
    E2E_CORE_PORT: String(PORTS.core),
    E2E_MAILER_PORT: String(PORTS.mailer),
    E2E_MEDIA_ROOT: `/tmp/myaegee-e2e${suffix}`,
    ...(service === 'statutory' ? { CONVERSION_RATE_API_HOST: `http://127.0.0.1:${PORTS.currency}` } : {})
});

export const PASSWORD = '5ecr3t5ecr3t';

// Usernames from core/scripts/seed.js that the tests use.
export const USERS = {
    admin: 'admin',
    member: 'member',
    board: 'board',
    netcom: 'netcom',
    nd: 'nd',
    fd: 'fd',
    suct: 'suct',
    eqac: 'eqac',
    chair: 'chair',
    notMember: 'not-member'
} as const;

export type SeedUsername = typeof USERS[keyof typeof USERS];

// Users that tests create themselves (see support/core-data.ts) are prefixed with `e2e-`.
export type TestUsername = `e2e-${string}`;

export type Username = SeedUsername | TestUsername;

export const url = (service: Service): string => `http://127.0.0.1:${PORTS[service]}`;
