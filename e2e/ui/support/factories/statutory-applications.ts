// Factories for the applications to statutory events. See base.ts for the rules, and
// statutory-events.ts for how the statutory factories are split.
import { iso } from './base.ts';
import type { Body } from './core.ts';
import { statutoryEventPermissions, type StatutoryEventPermissions } from './statutory-events.ts';

export type ParticipantType = 'delegate' | 'envoy' | 'observer' | 'visitor';
export type ApplicationStatus = 'pending' | 'waiting_list' | 'accepted' | 'rejected';

// An application as statutory stores it (models/Application.js).
export interface StatutoryApplication {
    id: number;
    event_id: number;
    user_id: number;
    body_id: number;
    body_name: string;
    statutory_id: string;
    first_name: string;
    last_name: string;
    gender: string;
    date_of_birth: string;
    nationality: string;
    email: string | null;
    // Filled from core by the endpoints that return it; not a column.
    notification_email?: string;
    meals: string;
    allergies: string | null;
    number_of_events_visited: number;
    visa_required: boolean;
    visa_place_of_birth: string | null;
    visa_passport_number: string | null;
    visa_passport_issue_date: string | null;
    visa_passport_expiration_date: string | null;
    visa_passport_issue_authority: string | null;
    visa_embassy: string | null;
    visa_street_and_house: string | null;
    visa_postal_code: string | null;
    visa_city: string | null;
    visa_country: string | null;
    answers: unknown[];
    // Not returned to the applicant (statutory #2399).
    board_comment?: string | null;
    participant_type: ParticipantType | null;
    participant_order: number | null;
    status: ApplicationStatus;
    cancelled: boolean;
    confirmed: boolean;
    incoming: boolean;
    attended: boolean;
    registered: boolean;
    departed: boolean;
    is_on_memberslist: boolean;
    is_on_previous_memberslist: boolean;
    created_at: string;
    updated_at: string;
}

export const statutoryApplication = (overrides: Partial<StatutoryApplication> = {}): StatutoryApplication => ({
    id: 12,
    event_id: 1,
    user_id: 2,
    body_id: 1,
    body_name: 'AEGEE-Antenna',
    statutory_id: '001-0001',
    first_name: 'Alex',
    last_name: 'Member',
    gender: 'female',
    date_of_birth: '2000-01-01',
    nationality: 'Belgian',
    email: null,
    meals: 'Vegetarian',
    allergies: '',
    number_of_events_visited: 0,
    visa_required: false,
    visa_place_of_birth: null,
    visa_passport_number: null,
    visa_passport_issue_date: null,
    visa_passport_expiration_date: null,
    visa_passport_issue_authority: null,
    visa_embassy: null,
    visa_street_and_house: null,
    visa_postal_code: null,
    visa_city: null,
    visa_country: null,
    answers: ['To meet the network'],
    board_comment: null,
    participant_type: null,
    participant_order: null,
    status: 'pending',
    cancelled: false,
    confirmed: false,
    incoming: false,
    attended: false,
    registered: false,
    departed: false,
    is_on_memberslist: false,
    is_on_previous_memberslist: false,
    created_at: iso(-3),
    updated_at: iso(-3),
    ...overrides
});

// What the viewer may do with one application (helpers.getApplicationPermissions), on top of
// the event's permissions. By default the applicant's own, editable application.
export interface ApplicationPermissions {
    see_application: boolean;
    see_application_incoming: boolean;
    edit_application: boolean;
    set_application_cancelled: boolean;
    set_application_confirmed: boolean;
    set_application_incoming: boolean;
    set_application_attended: boolean;
    set_application_registered: boolean;
    set_application_departed: boolean;
    set_application_is_on_memberslist: boolean;
    change_status: boolean;
}

export const applicationPermissions = (overrides: Partial<ApplicationPermissions> = {}): ApplicationPermissions => ({
    see_application: true,
    see_application_incoming: false,
    edit_application: true,
    set_application_cancelled: true,
    set_application_confirmed: false,
    set_application_incoming: false,
    set_application_attended: false,
    set_application_registered: false,
    set_application_departed: false,
    set_application_is_on_memberslist: false,
    change_status: false,
    ...overrides
});

// GET /events/:id/applications/:application_id (also `me`): the application, the bodies the
// applicant may move it to (empty unless it may be edited) and the permissions. By default the
// applicant's own, without the board comment; pass `board_comment` for the view of a board
// member or a manager.
export interface SingleStatutoryApplication extends StatutoryApplication {
    editable_bodies: Body[];
    permissions: StatutoryEventPermissions & ApplicationPermissions;
}

export const singleStatutoryApplication = (
    overrides: Partial<StatutoryApplication> & { editable_bodies?: Body[] } = {},
    permissions: Partial<StatutoryEventPermissions & ApplicationPermissions> = {}
): SingleStatutoryApplication => {
    const { editable_bodies: editableBodies, ...rest } = overrides;
    return {
        ...statutoryApplication({ board_comment: undefined, ...rest }),
        editable_bodies: editableBodies ?? [],
        permissions: { ...statutoryEventPermissions(), ...applicationPermissions(), ...permissions }
    };
};

// An application as the lists of all applications (GET /events/:id/applications/all) and of
// the board view (GET /events/:id/applications/boardview/:body_id) have it: every field, and the
// address core has for the applicant.
export interface ListedApplication extends StatutoryApplication {
    notification_email: string;
}

export const listedApplication = (overrides: Partial<ListedApplication> = {}): ListedApplication => {
    const application = statutoryApplication({ board_comment: null, ...overrides });
    return { ...application, notification_email: overrides.notification_email ?? `member${application.user_id}@example.com` };
};

// The fields the incoming team gets (constants.ALLOWED_INCOMING_FIELDS).
const INCOMING_FIELDS = [
    'id', 'statutory_id', 'user_id', 'body_id', 'body_name', 'participant_type', 'participant_order',
    'confirmed', 'incoming', 'attended', 'registered', 'departed', 'first_name', 'last_name', 'meals',
    'allergies', 'date_of_birth', 'visa_place_of_birth', 'visa_passport_number', 'visa_passport_issue_date',
    'visa_passport_expiration_date', 'visa_passport_issue_authority', 'visa_embassy', 'visa_street_and_house',
    'visa_postal_code', 'visa_city', 'visa_country', 'created_at', 'updated_at'
] as const;

// An accepted application as the incoming list (GET /events/:id/applications/incoming) has it:
// what the incoming team needs, and the applicant's address from core.
export type IncomingApplication = Pick<StatutoryApplication, typeof INCOMING_FIELDS[number]> & { notification_email: string };

export const incomingApplication = (overrides: Partial<IncomingApplication> = {}): IncomingApplication => {
    const full = statutoryApplication({ status: 'accepted', participant_type: 'delegate', participant_order: 1, ...overrides });
    const picked = Object.fromEntries(INCOMING_FIELDS.map((field) => [field, full[field]])) as Pick<StatutoryApplication, typeof INCOMING_FIELDS[number]>;
    return { ...picked, notification_email: overrides.notification_email ?? `member${full.user_id}@example.com` };
};
