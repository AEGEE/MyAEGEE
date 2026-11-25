// Factories for the statistics of the applications to a statutory event and for the lists of
// application fields its exports offer. See base.ts for the rules, and statutory-events.ts for
// how the statutory factories are split.
import type { ParticipantType } from './statutory-applications.ts';
import type { StatutoryQuestion } from './statutory-events.ts';

// One slice of a breakdown: how many non-cancelled applications have this value
// (helpers.countByField). `type` is the value: a gender, a meal, a participant type (null when
// not set yet), a body id or a number of events visited.
export interface StatCount<T> {
    type: T;
    value: number;
}

export interface StatDay {
    date: string;
    value: number;
}

// What GET /events/:id/applications/stats answers (applications.getStats and quorum.js).
export interface StatutoryStats {
    numbers: {
        total: number;
        accepted: number;
        rejected: number;
        pending: number;
        waiting_list: number;
        cancelled: number;
        confirmed: number;
        registered: number;
        attended: number;
        departed: number;
    };
    // The bodies represented: by any non-cancelled application, or once the participants list
    // is published (`accepted_only`) by an accepted delegate only.
    quorum: { accepted_only: boolean; body_ids: number[] };
    // Every day from the first application to the last one, also days without any.
    by_date: StatDay[];
    by_date_cumulative: StatDay[];
    by_gender: StatCount<string>[];
    by_meal: StatCount<string>[];
    by_type: StatCount<ParticipantType | null>[];
    by_body: StatCount<number>[];
    by_number_of_events_visited: StatCount<number>[];
}

// Five applications from two bodies, over two days, of which one is cancelled. The breakdowns
// count the four that are not, sorted the way statutory sorts them: most first, and the number
// of events visited from the lowest. Bodies are referred to by id (1 and 2).
export const statutoryStats = (overrides: Partial<StatutoryStats> = {}): StatutoryStats => ({
    numbers: {
        total: 5,
        accepted: 2,
        rejected: 0,
        pending: 1,
        waiting_list: 1,
        cancelled: 1,
        confirmed: 1,
        registered: 0,
        attended: 0,
        departed: 0
    },
    quorum: { accepted_only: false, body_ids: [1, 2] },
    by_date: [{ date: '2027-02-20', value: 3 }, { date: '2027-02-21', value: 1 }],
    by_date_cumulative: [{ date: '2027-02-20', value: 3 }, { date: '2027-02-21', value: 4 }],
    by_gender: [{ type: 'male', value: 2 }, { type: 'F', value: 1 }, { type: 'non-binary', value: 1 }],
    by_meal: [{ type: 'Vegetarian', value: 2 }, { type: 'Meat-eater', value: 1 }, { type: 'Vegan', value: 1 }],
    by_type: [{ type: 'delegate', value: 2 }, { type: 'visitor', value: 1 }, { type: null, value: 1 }],
    by_body: [{ type: 1, value: 3 }, { type: 2, value: 1 }],
    by_number_of_events_visited: [{ type: 0, value: 2 }, { type: 3, value: 2 }],
    ...overrides
});

// The fields of an application and their names (constants.APPLICATION_FIELD_NAMES).
const APPLICATION_FIELD_NAMES = {
    id: 'ID',
    statutory_id: 'Statutory ID',
    user_id: 'User ID',
    body_id: 'Body ID',
    created_at: 'Applied on',
    updated_at: 'Updated at',
    is_on_memberslist: 'Is on memberslist?',
    is_on_previous_memberslist: 'Was on previous memberslist?',
    visa_required: 'Visa required?',
    participant_type: 'Participant type',
    participant_order: 'Participant order',
    board_comment: 'Board comment',
    status: 'Status',
    cancelled: 'Cancelled?',
    confirmed: 'Confirmed?',
    incoming: 'Incoming form filled?',
    attended: 'Attended?',
    registered: 'JC registered?',
    departed: 'Departed?',
    first_name: 'First name',
    last_name: 'Last name',
    notification_email: 'Email',
    gender: 'Gender',
    body_name: 'Body name',
    nationality: 'Nationality',
    visa_place_of_birth: 'Visa: place of birth',
    visa_passport_number: 'Visa: passport number',
    visa_passport_issue_date: 'Visa: passport issue date',
    visa_passport_expiration_date: 'Visa: passport expiration date',
    visa_passport_issue_authority: 'Visa: passport issue authority',
    visa_embassy: 'Visa: embassy',
    visa_street_and_house: 'Visa: street and house number',
    visa_postal_code: 'Visa: postal code',
    visa_city: 'Visa: city',
    visa_country: 'Visa: country',
    date_of_birth: 'Date of birth',
    number_of_events_visited: 'Number of Agora/EPM visited',
    meals: 'Meals',
    allergies: 'Allergies'
} as const;

// The fields the incoming team may export (constants.ALLOWED_INCOMING_FIELDS).
const INCOMING_FIELDS = [
    'id', 'statutory_id', 'user_id', 'body_id', 'body_name', 'participant_type', 'participant_order',
    'confirmed', 'incoming', 'attended', 'registered', 'departed', 'first_name', 'last_name', 'meals',
    'allergies', 'date_of_birth', 'visa_place_of_birth', 'visa_passport_number', 'visa_passport_issue_date',
    'visa_passport_expiration_date', 'visa_passport_issue_authority', 'visa_embassy', 'visa_street_and_house',
    'visa_postal_code', 'visa_city', 'visa_country', 'created_at', 'updated_at'
] as const;

// Field key -> the name the export page shows for it. An object, not a list.
export type ApplicationFields = Record<string, string>;

// What GET /events/:id/fields/applications/all answers (helpers.getApplicationFields): every
// field of an application, and one per question of the event ("answers.0": "Answer 1: Why?").
export const applicationFields = (questions: Pick<StatutoryQuestion, 'description'>[] = [{ description: 'Why do you want to go?' }]): ApplicationFields => ({
    ...APPLICATION_FIELD_NAMES,
    ...Object.fromEntries(questions.map((question, index) => [`answers.${index}`, `Answer ${index + 1}: ${question.description}`]))
});

// What GET /events/:id/fields/applications/incoming answers: the incoming team's fields only,
// without the answers to the questions.
export const incomingApplicationFields = (): ApplicationFields => Object.fromEntries(INCOMING_FIELDS.map((field) => [field, APPLICATION_FIELD_NAMES[field]]));
