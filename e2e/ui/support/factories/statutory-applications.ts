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
