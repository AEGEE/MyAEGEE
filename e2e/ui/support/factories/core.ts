// Factories for what core answers. See base.ts for the rules.
import { loadSeedPermissions } from '../../../support/core.ts';
import { date, id, iso } from './base.ts';

// Exports of this file that don't build an entity of their own, so they need no contract
// check (scripts/check-factory-contracts.ts).
export const NOT_ENTITIES = ['seedPermissions', 'allSeedPermissions'];

export interface Body {
    id: number;
    name: string;
    description: string;
    task_description: string | null;
    code: string;
    abbreviation: string | null;
    email: string;
    phone: string | null;
    address: string;
    type: 'antenna' | 'contact antenna' | 'contact' | 'interest group' | 'working group' | 'commission' | 'committee' | 'project' | 'partner' | 'other' | 'external';
    fee_currency: string | null;
    pays_fees: boolean;
    founded_at: string | null;
    status: 'active' | 'deleted';
    country: string | null;
    website: string | null;
    shadow_circle_id: number | null;
    created_at: string;
    updated_at: string;
}

export const body = (overrides: Partial<Body> = {}): Body => {
    const bodyId = overrides.id ?? id();
    return {
        id: bodyId,
        name: `AEGEE-Test ${bodyId}`,
        description: 'A test antenna',
        task_description: null,
        code: `T${bodyId}`.slice(0, 3).toUpperCase(),
        abbreviation: null,
        email: `antenna-${bodyId}@example.com`,
        phone: null,
        address: 'Somewhere in Europe',
        type: 'antenna',
        fee_currency: null,
        pays_fees: true,
        founded_at: '1985-04-15',
        status: 'active',
        country: null,
        website: null,
        shadow_circle_id: null,
        created_at: iso(-400),
        updated_at: iso(-10),
        ...overrides
    };
};

export interface EventApplicationBan {
    ban_until: string;
    reason?: string;
}

export interface Member {
    id: number;
    username: string;
    email: string;
    notification_email: string;
    first_name: string;
    last_name: string;
    superadmin: boolean;
    active: boolean;
    privacy_consent: string | null;
    mail_confirmed_at: string | null;
    date_of_birth: string | null;
    gender: string | null;
    phone: string | null;
    address: string | null;
    about_me: string | null;
    image: string | null;
    primary_email: string;
    primary_body_id: number | null;
    primary_body: Body | null;
    bodies: Body[];
    circles: unknown[];
    join_requests: unknown[];
    event_application_ban: EventApplicationBan | null;
    created_at: string;
    updated_at: string;
}

export const member = (overrides: Partial<Member> = {}): Member => {
    const memberId = overrides.id ?? id();
    const bodies = overrides.bodies ?? [body({ id: 1, name: 'AEGEE-Antenna' })];
    return {
        id: memberId,
        username: `member${memberId}`,
        email: `member${memberId}@example.com`,
        notification_email: `member${memberId}@example.com`,
        first_name: 'Alex',
        last_name: 'Member',
        superadmin: false,
        active: true,
        privacy_consent: iso(-300),
        mail_confirmed_at: iso(-300),
        date_of_birth: '1999-05-01',
        gender: 'neutral',
        phone: '',
        address: 'Somewhere in Europe',
        about_me: null,
        image: null,
        primary_email: 'personal',
        primary_body_id: bodies[0]?.id ?? null,
        primary_body: bodies[0] ?? null,
        bodies,
        circles: [],
        join_requests: [],
        event_application_ban: null,
        created_at: iso(-300),
        updated_at: iso(-1),
        ...overrides
    };
};

// A circle as the lists have it (`GET core /circles`, a body's or member's `circles`).
export interface Circle {
    id: number;
    name: string;
    description: string;
    gsuite_id: string | null;
    // Set for a circle bound to a body; free circles have none.
    body_id: number | null;
    parent_circle_id: number | null;
    created_at: string;
    updated_at: string;
}

export const circle = (overrides: Partial<Circle> = {}): Circle => {
    const circleId = overrides.id ?? id();
    return {
        id: circleId,
        name: `Test circle ${circleId}`,
        description: 'A circle for testing',
        gsuite_id: null,
        body_id: null,
        parent_circle_id: null,
        created_at: iso(-200),
        updated_at: iso(-20),
        ...overrides
    };
};

// A row of `GET core /members_search`. Everyone who may search gets the id and the name; the
// last three fields only come with `global:view:member`, so pass them for such a session.
export interface MemberSearchResult {
    id: number;
    first_name: string;
    last_name: string;
    username?: string;
    email?: string;
    gsuite_id?: string | null;
}

export const memberSearchResult = (overrides: Partial<MemberSearchResult> = {}): MemberSearchResult => ({
    id: id(),
    first_name: 'Alex',
    last_name: 'Member',
    ...overrides
});

// What `GET core /members/:id` adds to the user's own fields.
const MEMBER_RELATIONS = ['primary_body', 'bodies', 'circles', 'join_requests', 'event_application_ban'] as const;

// The user inside a membership: the user's own fields only.
export interface MembershipUser extends Omit<Member, typeof MEMBER_RELATIONS[number]> {
    gsuite_id: string | null;
    campaign_id: number | null;
    last_logged_in: string | null;
    last_active: string | null;
}

// A row of `GET core /bodies/:id/members`.
export interface BodyMembership {
    id: number;
    user_id: number;
    body_id: number;
    comment: string | null;
    user: MembershipUser;
    created_at: string;
    updated_at: string;
}

export const bodyMembership = (overrides: Partial<BodyMembership> = {}): BodyMembership => {
    const bodyId = overrides.body_id ?? 1;
    const full = member({
        ...(overrides.user_id === undefined ? {} : { id: overrides.user_id }),
        bodies: [body({ id: bodyId })]
    });
    const own = Object.fromEntries(
        Object.entries(full).filter(([key]) => !(MEMBER_RELATIONS as readonly string[]).includes(key))
    ) as Omit<Member, typeof MEMBER_RELATIONS[number]>;
    const user: MembershipUser = overrides.user ?? {
        ...own,
        gsuite_id: null,
        campaign_id: null,
        last_logged_in: iso(-1),
        last_active: iso(-1)
    };
    return {
        id: id(),
        body_id: bodyId,
        comment: null,
        created_at: iso(-300),
        updated_at: iso(-300),
        ...overrides,
        user,
        user_id: user.id
    };
};

// A membership fee payment (`GET core /bodies/:id/payments`).
export interface Payment {
    id: number;
    user_id: number;
    body_id: number;
    // Dates without a time: `2026-01-01`.
    starts: string;
    expires: string;
    // Core sends the amount as a number (12.5), not as the string Postgres stores decimals as.
    amount: number;
    currency: string;
    comment: string | null;
    invoice_name: string | null;
    invoice_address: string | null;
    created_at: string;
    updated_at: string;
}

export const payment = (overrides: Partial<Payment> = {}): Payment => ({
    id: id(),
    user_id: 1,
    body_id: 1,
    starts: date(-30),
    expires: date(335),
    amount: 12.5,
    currency: 'EU',
    comment: null,
    invoice_name: null,
    invoice_address: null,
    created_at: iso(-30),
    updated_at: iso(-30),
    ...overrides
});

// A signup campaign as everyone without `global:create:campaign` gets it, logged in or not
// (`GET core /campaigns/:url`, the page at /signup/:url): the public fields only, and of the
// body people join through it just what the page shows.
export interface PublicCampaign {
    id: number;
    url: string;
    name: string;
    active: boolean;
    description_short: string | null;
    description_long: string;
    autojoin_body: Pick<Body, 'id' | 'name' | 'email' | 'phone' | 'address' | 'website'> | null;
}

export const publicCampaign = (overrides: Partial<PublicCampaign> = {}): PublicCampaign => {
    const campaignId = overrides.id ?? id();
    return {
        id: campaignId,
        url: `campaign-${campaignId}`,
        name: `Recruitment campaign ${campaignId}`,
        active: true,
        description_short: 'Join us',
        description_long: 'Sign up and **join** our antenna.',
        autojoin_body: {
            id: 1,
            name: 'AEGEE-Antenna',
            email: 'antenna-1@example.com',
            phone: null,
            address: 'Somewhere in Europe',
            website: null
        },
        ...overrides
    };
};

export interface Permission {
    id: number;
    scope: 'global' | 'local' | 'join_request';
    action: string;
    object: string;
    combined: string;
    description: string;
    filters: unknown[];
}

// `combined` is `scope:action:object`, e.g. `global:create:event`.
export const permission = (combined: string): Permission => {
    const [scope, action, object] = combined.split(':');
    return {
        id: id(),
        scope: scope as Permission['scope'],
        action,
        object,
        combined,
        description: `Allows to ${action} ${object}`,
        filters: []
    };
};

const seed = loadSeedPermissions();

// What `GET core /my_permissions` answers for a member of these circles of the seed
// (core/scripts/seed-permissions.js: 'membersCircle', 'boardCircle', 'adminCircle', ...).
// Like core, it leaves out the circles' local permissions: those only count inside a body or
// circle, and the frontend asks for them per object (permissionsFor() in ui/support/shell.ts).
export const seedPermissions = (...circleKeys: string[]): Permission[] => {
    const combined = new Set<string>();
    for (const key of circleKeys) {
        const ofCircle = seed.CIRCLE_PERMISSIONS[key];
        if (!ofCircle) throw new Error(`No circle "${key}" in core/scripts/seed-permissions.js (there are: ${Object.keys(seed.CIRCLE_PERMISSIONS).join(', ')})`);
        ofCircle.filter((item) => item.startsWith('global:')).forEach((item) => combined.add(item));
    }
    return [...combined].map(permission);
};

// What `GET core /my_permissions` answers for a superadmin: every permission there is.
export const allSeedPermissions = (): Permission[] => seed.PERMISSIONS
    .map(({ scope, action, object }) => permission(`${scope}:${action}:${object}`));
