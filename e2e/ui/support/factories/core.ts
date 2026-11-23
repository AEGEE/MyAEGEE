// Factories for what core answers. See base.ts for the rules.
import { loadSeedPermissions } from '../../../support/core.ts';
import { id, iso } from './base.ts';

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
        const circle = seed.CIRCLE_PERMISSIONS[key];
        if (!circle) throw new Error(`No circle "${key}" in core/scripts/seed-permissions.js (there are: ${Object.keys(seed.CIRCLE_PERMISSIONS).join(', ')})`);
        circle.filter((item) => item.startsWith('global:')).forEach((item) => combined.add(item));
    }
    return [...combined].map(permission);
};

// What `GET core /my_permissions` answers for a superadmin: every permission there is.
export const allSeedPermissions = (): Permission[] => seed.PERMISSIONS
    .map(({ scope, action, object }) => permission(`${scope}:${action}:${object}`));
