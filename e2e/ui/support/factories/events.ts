// Factories for what the events service answers. See base.ts for the rules.
import { id, iso } from './base.ts';

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

// The list endpoints return the summary fields only (EVENT_PUBLIC_FIELDS in events).
const SUMMARY_FIELDS: (keyof EventSummary)[] = [
    'id', 'name', 'url', 'image', 'description', 'application_starts', 'application_ends', 'starts', 'ends',
    'fee', 'optional_fee', 'organizing_bodies', 'locations', 'type', 'max_participants', 'application_status',
    'status', 'meals_per_day', 'accommodation_type', 'optional_programme', 'link_info_travel_country', 'method',
    'has_applications'
];

export const eventSummary = (overrides: Partial<Event> = {}): EventSummary => {
    const full = event(overrides);
    return Object.fromEntries(SUMMARY_FIELDS.map((field) => [field, full[field]])) as unknown as EventSummary;
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
