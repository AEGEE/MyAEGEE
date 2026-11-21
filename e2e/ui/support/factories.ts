// Typed builders for the API responses the frontend gets. Each returns a complete, realistic
// object (shaped like the real services answer, see tests/fixture-contract.spec.ts, which
// checks that against the real stack) and takes overrides for what a test cares about.
//
// Dates are relative to now, so "open for applications" stays true whenever the tests run.

const DAY = 24 * 60 * 60 * 1000;
const iso = (offsetDays: number): string => new Date(Date.now() + offsetDays * DAY).toISOString();
const date = (offsetDays: number): string => iso(offsetDays).slice(0, 10);

let nextId = 1000;
const id = (): number => nextId++;

// --- Envelopes -------------------------------------------------------------------------------

export interface Envelope<T> {
    success: boolean;
    data: T;
    message?: string;
    meta?: Record<string, unknown>;
    permissions?: unknown;
    errors?: Record<string, string[]>;
}

export const ok = <T>(data: T, extra: Partial<Envelope<T>> = {}): Envelope<T> => ({ success: true, data, ...extra });

export const validationError = (errors: Record<string, string[]>) => ({ success: false, errors });

export const notFound = (message: string) => ({ success: false, message });

// --- core ------------------------------------------------------------------------------------

export interface Body {
    id: number;
    name: string;
    description: string;
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
    scope: 'global' | 'local';
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

// What a regular antenna member has (the seeded `member` user, see core/scripts/seed-permissions.js).
export const MEMBER_PERMISSIONS = ['global:join:circle', 'global:create:event', 'global:apply:summeruniversity'];

// --- events ----------------------------------------------------------------------------------

export type QuestionType = 'string' | 'text' | 'number' | 'checkbox' | 'select';

export interface Question {
    type: QuestionType;
    description: string;
    required: boolean;
    values?: string[];
}

export const question = (overrides: Partial<Question> & { type: QuestionType }): Question => ({
    description: `A ${overrides.type} question`,
    required: false,
    ...(overrides.type === 'select' ? { values: ['First option', 'Second option'] } : {}),
    ...overrides
});

export interface EventLocation {
    name: string;
    position: { lat: number; lng: number };
}

export interface OrganizingBody {
    body_id: number;
    body_name: string;
}

export type EventType = 'training' | 'nwm' | 'conference' | 'cultural' | 'thematic';

// The fields every event response has (EVENT_PUBLIC_FIELDS in events/lib/constants.js).
export interface EventSummary {
    id: number;
    name: string;
    url: string;
    image: string | null;
    description: string;
    application_starts: string;
    application_ends: string;
    starts: string;
    ends: string;
    fee: number;
    optional_fee: number | null;
    organizing_bodies: OrganizingBody[];
    locations: EventLocation[];
    type: EventType;
    max_participants: number;
    application_status: 'open' | 'closed';
    status: 'draft' | 'submitted' | 'published';
    meals_per_day: number;
    accommodation_type: string;
    optional_programme: string | null;
    link_info_travel_country: string | null;
    method: 'in person' | 'online' | 'hybrid';
    has_applications: boolean;
}

// What /single/:id returns on top of the summary.
export interface Event extends EventSummary {
    questions: Question[];
    publication_date: string | null;
    budget?: string | null;
    programme?: string | null;
    organizers?: { user_id: number; first_name?: string; last_name?: string }[];
    vegetarian?: boolean;
    is_european_event?: boolean | null;
    created_at: string;
    updated_at: string;
}

export const event = (overrides: Partial<Event> = {}): Event => {
    const eventId = overrides.id ?? id();
    return {
        id: eventId,
        name: `Training Course ${eventId}`,
        url: `training-${eventId}`,
        image: null,
        description: 'A **great** event to learn things.',
        application_starts: iso(-5),
        application_ends: iso(10),
        starts: iso(20),
        ends: iso(25),
        fee: 50,
        optional_fee: 0,
        organizing_bodies: [{ body_id: 1, body_name: 'AEGEE-Antenna' }],
        locations: [],
        type: 'training',
        max_participants: 25,
        application_status: 'open',
        status: 'published',
        meals_per_day: 3,
        accommodation_type: 'Hostel',
        optional_programme: null,
        link_info_travel_country: null,
        method: 'in person',
        has_applications: true,
        questions: [],
        publication_date: iso(-6),
        created_at: iso(-30),
        updated_at: iso(-6),
        ...overrides
    };
};

// The list endpoints return the summary fields only.
export const eventSummary = (overrides: Partial<Event> = {}): EventSummary => {
    const {
        questions: _questions, publication_date: _publication, created_at: _created, updated_at: _updated,
        budget: _budget, programme: _programme, organizers: _organizers, vegetarian: _vegetarian, is_european_event: _european,
        ...summary
    } = event(overrides);
    return summary;
};

const EVENT_TYPES: EventType[] = ['training', 'nwm', 'conference', 'cultural', 'thematic'];
const byType = <T>(value: T): Record<EventType, T> => Object.fromEntries(EVENT_TYPES.map((type) => [type, value])) as Record<EventType, T>;

// The `permissions` part of the /single/:id response (helpers.js in events), here for a
// regular member looking at a published event.
export interface EventPermissions {
    approve_event: Record<EventType, boolean>;
    manage_event: Record<EventType, boolean>;
    change_european_event_status: Record<EventType, boolean>;
    create_event: boolean;
    set_board_comment: Record<string, boolean>;
    see_boardview: Record<string, boolean>;
    see_event: boolean;
    edit_event: boolean;
    delete_event: boolean;
    apply: boolean;
    list_applications: boolean;
    approve_participants: boolean;
    set_participants_attended: boolean;
    set_participants_confirmed: boolean;
    export: boolean;
    change_status: { draft: boolean; submitted: boolean; published: boolean };
}

export const eventPermissions = (overrides: Partial<EventPermissions> = {}): EventPermissions => ({
    approve_event: byType(false),
    manage_event: byType(false),
    change_european_event_status: byType(false),
    create_event: true,
    set_board_comment: { 1: false },
    see_boardview: { 1: false },
    see_event: true,
    edit_event: false,
    delete_event: false,
    apply: true,
    list_applications: false,
    approve_participants: false,
    set_participants_attended: false,
    set_participants_confirmed: false,
    export: false,
    change_status: { draft: false, submitted: false, published: false },
    ...overrides
});

// Everything an organiser/EQAC member gets.
export const organizerPermissions = (): EventPermissions => eventPermissions({
    approve_event: byType(true),
    manage_event: byType(true),
    edit_event: true,
    delete_event: true,
    list_applications: true,
    change_status: { draft: true, submitted: true, published: true }
});

export interface Application {
    id: number;
    user_id: number;
    body_id: number;
    event_id: number;
    first_name: string;
    last_name: string;
    email: string | null;
    notification_email?: string;
    body_name: string;
    status: 'pending' | 'accepted' | 'rejected';
    confirmed: boolean;
    attended: boolean;
    board_comment: string | null;
    answers: unknown[];
    agreed_to_privacy_policy: boolean;
    created_at: string;
    updated_at: string;
}

export const application = (overrides: Partial<Application> = {}): Application => ({
    id: id(),
    user_id: 1,
    body_id: 1,
    event_id: 1,
    first_name: 'Alex',
    last_name: 'Member',
    email: null,
    body_name: 'AEGEE-Antenna',
    status: 'pending',
    confirmed: false,
    attended: false,
    board_comment: null,
    answers: [],
    agreed_to_privacy_policy: true,
    created_at: iso(-2),
    updated_at: iso(-2),
    ...overrides
});

export { iso, date, DAY };
