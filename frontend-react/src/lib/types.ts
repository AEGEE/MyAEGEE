// The API shapes this app uses. The same shapes are built by the Playwright fixture factories
// (e2e/ui/support/factories.ts), which a real-stack test checks against the services.
export interface Body {
    id: number;
    name: string;
    type: string;
}

export interface Member {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    superadmin: boolean;
    privacy_consent: string | null;
    primary_body_id: number | null;
    bodies: Body[];
    event_application_ban: { ban_until: string } | null;
}

export interface Permission {
    combined: string;
}

export type EventType = 'training' | 'nwm' | 'conference' | 'cultural' | 'thematic';

export const EVENT_TYPE_NAMES: Record<EventType, string> = {
    training: 'Training Event',
    nwm: 'Network Meeting',
    conference: 'Conference',
    cultural: 'Cultural Event',
    thematic: 'Thematic Event'
};

export interface Question {
    type: 'string' | 'text' | 'number' | 'checkbox' | 'select';
    description: string;
    required: boolean;
    values?: string[];
}

export interface EventSummary {
    id: number;
    name: string;
    url: string | null;
    image: string | null;
    description: string;
    application_starts: string;
    application_ends: string;
    starts: string;
    ends: string;
    fee: number | null;
    optional_fee: number | null;
    organizing_bodies: { body_id: number; body_name: string }[];
    locations: { name: string; position: { lat: number; lng: number } }[];
    type: EventType;
    max_participants: number;
    application_status: 'open' | 'closed';
    status: 'draft' | 'submitted' | 'published';
    meals_per_day: number;
    accommodation_type: string;
    optional_programme: string | null;
    link_info_travel_country: string | null;
    method: string;
    has_applications: boolean;
}

export interface Event extends EventSummary {
    questions: Question[];
    budget?: string | null;
    programme?: string | null;
    vegetarian?: boolean;
    is_european_event?: boolean | null;
}

export interface EventPermissions {
    approve_event: Partial<Record<EventType, boolean>>;
    change_european_event_status: Partial<Record<EventType, boolean>>;
    edit_event: boolean;
    delete_event: boolean;
    list_applications: boolean;
    change_status: { draft: boolean; submitted: boolean; published: boolean };
}

export interface Application {
    id: number;
    body_id: number;
    status: 'pending' | 'accepted' | 'rejected';
    answers: unknown[];
    agreed_to_privacy_policy: boolean;
}

// Where an event lives: its URL slug if it has one.
export const eventKey = (event: Pick<EventSummary, 'url' | 'id'>): string => event.url || String(event.id);
