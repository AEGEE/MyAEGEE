// Factories for what the summeruniversity service answers. See base.ts for the rules, and
// summeruniversity/openapi.yaml for the shapes these follow.
import { date, id, iso } from './base.ts';

export type SuType = 'regular' | 'pilot';
export type SuStatus = 'first draft' | 'first submission' | 'first approval' | 'second draft' | 'second submission' | 'second approval';
export type SuPublished = 'none' | 'minimal' | 'full';
export type SuThemeCategory = 'arts_creativity' | 'sustainability' | 'local_culture' | 'sports' | 'social_equity'
    | 'political_activism' | 'mental_health' | 'leisure' | 'personal_development' | 'volunteering';
export type SuPaxConfirmation = 'no_confirmation' | 'payment' | 'ticket' | 'payment_or_ticket' | 'payment_and_ticket';
export type SuApplicationStatus = 'pending' | 'accepted' | 'rejected';

const SU_TYPES: SuType[] = ['regular', 'pilot'];

// A season (`GET summeruniversity /seasons`). The dates are null until SUCT sets them.
export interface SuSeason {
    id: number;
    year: number;
    name: string;
    active: boolean;
    event_submission_deadline: string | null;
    application_period_starts: string | null;
    application_period_ends: string | null;
    created_at: string;
    updated_at: string;
}

export const suSeason = (overrides: Partial<SuSeason> = {}): SuSeason => {
    const year = overrides.year ?? 2027;
    return {
        id: id(),
        year,
        name: `Summer University ${year}`,
        active: true,
        event_submission_deadline: iso(-60),
        application_period_starts: iso(-5),
        application_period_ends: iso(30),
        created_at: iso(-200),
        updated_at: iso(-60),
        ...overrides
    };
};

// An organizing or cooperation body, with the name it had when the SU was saved.
export interface SuBodyRef {
    body_id: number;
    body_name: string;
}

export interface SuLocation {
    name: string;
    position: { lat: number; lng: number };
    description?: string;
    // Whether the SU starts or ends here: a boolean, or the text "true" or "false" that the
    // edit forms used to send.
    start?: boolean | string;
    end?: boolean | string;
}

export const suLocation = (overrides: Partial<SuLocation> = {}): SuLocation => ({
    name: 'Brussels',
    position: { lat: 50.85, lng: 4.35 },
    description: 'Where the SU starts',
    start: true,
    end: false,
    ...overrides
});

// Organisers are stored with their user id and role only: no names.
export interface SuOrganizer {
    user_id: number;
    role: string;
    body_id?: number;
}

export interface SuSocialMedium {
    name?: string;
    // The link.
    description: string;
}

// SU questions have only a description: every question needs an answer.
export interface SuQuestion {
    name?: string;
    description: string;
    required?: boolean;
}

// The fields of an SU published as minimal (EVENT_MINIMAL_FIELDS in summeruniversity/lib/constants.js).
export interface SuEventMinimal {
    id: number;
    name: string;
    url: string | null;
    season: number | null;
    image: string | null;
    description: string;
    email: string;
    starts: string;
    ends: string;
    // A DECIMAL column, which summeruniversity reads as a number.
    fee: number;
    organizing_bodies: SuBodyRef[];
    locations: SuLocation[];
    type: SuType;
    theme_category: SuThemeCategory;
    theme: string;
    max_participants: number | null;
    accommodation_type: string;
    optional_fee: number | null;
    optional_programme: string | null;
    published: SuPublished;
    application_status: 'open' | 'closed';
    created_at: string;
    updated_at: string;
}

// The fields of a fully published SU (EVENT_FULL_FIELDS): what everybody but its organisers
// and SUCT gets.
export interface SuEventFull extends SuEventMinimal {
    photos: SuSocialMedium[] | null;
    video: string | null;
    website: string | null;
    social_media: SuSocialMedium[] | null;
    trainers: string | null;
    pax_description: string | null;
    pax_confirmation: SuPaxConfirmation | null;
    questions: SuQuestion[] | null;
    accepted_participants: number | null;
    // max_participants minus accepted_participants.
    available_spots: number;
    open_call: boolean | null;
    activities_list: string | null;
    course_level: 'beginner' | 'intermediate' | 'advanced' | null;
    // A text, not a list.
    courses: string | null;
    special_equipment: string | null;
    university_support: boolean | null;
    cancellation_rules: string | null;
    additional_regulation: string | null;
    application_starts: string | null;
    application_ends: string | null;
}

// Every column, as organisers and SUCT get an SU (`GET /single/:id`, `/mine/organizing`,
// `/mine/approvable`).
export interface SuEvent extends SuEventFull {
    cooperation: SuBodyRef[] | null;
    theme_implementation: string;
    learning_objectives: { name?: string; description: string }[] | null;
    status: SuStatus;
    deleted: boolean;
    organizers: SuOrganizer[];
    budget: string | null;
    programme_suct: string;
    programme: string | null;
    agreed_to_su_terms: boolean;
}

// By default a regular SU in its second approval, fully published and open for applications,
// with every optional field filled.
export const suEvent = (overrides: Partial<SuEvent> = {}): SuEvent => {
    const eventId = overrides.id ?? id();
    return {
        id: eventId,
        name: `Summer University ${eventId}`,
        url: `su-${eventId}`,
        season: 2027,
        image: null,
        photos: [{ name: '', description: 'https://photos.example.org/su' }],
        video: 'https://video.example.org/su',
        description: 'Two weeks of **hiking** and language courses.',
        email: `su-${eventId}@example.org`,
        website: 'https://su.example.org',
        social_media: [{ name: '', description: 'https://social.example.org/su' }],
        application_starts: iso(-5),
        application_ends: iso(10),
        starts: iso(40),
        ends: iso(54),
        fee: 150,
        optional_fee: 20,
        organizing_bodies: [{ body_id: 1, body_name: 'AEGEE-Antenna' }],
        cooperation: [{ body_id: 4, body_name: 'AEGEE-Partner' }],
        locations: [suLocation()],
        type: 'regular',
        theme_category: 'leisure',
        theme: 'Mountains and languages',
        theme_implementation: 'Every day starts with a walk and a language lesson.',
        learning_objectives: [{ name: '', description: 'Speak a new language' }],
        status: 'second approval',
        published: 'full',
        deleted: false,
        organizers: [{ user_id: 7, role: 'main_coordinator' }],
        trainers: 'Two language trainers',
        questions: [{ name: '', description: 'Why this SU?' }],
        pax_description: 'Somebody who likes walking',
        pax_confirmation: 'payment',
        max_participants: 25,
        accepted_participants: 15,
        available_spots: 10,
        application_status: 'open',
        open_call: false,
        budget: 'https://budget.example.org/su',
        programme_suct: 'https://programme.example.org/su',
        programme: 'A walk every morning',
        activities_list: 'Hiking, cooking, a city tour',
        optional_programme: 'A day trip to the sea',
        course_level: 'beginner',
        courses: 'Basic Spanish',
        accommodation_type: 'Hostel',
        special_equipment: 'Walking shoes',
        university_support: true,
        cancellation_rules: 'No refunds after the first of June',
        additional_regulation: 'No smoking in the hostel',
        agreed_to_su_terms: true,
        created_at: iso(-90),
        updated_at: iso(-6),
        ...overrides
    };
};

const MINIMAL_FIELDS: (keyof SuEventMinimal)[] = [
    'id', 'name', 'url', 'season', 'image', 'description', 'email', 'starts', 'ends', 'fee', 'organizing_bodies',
    'locations', 'type', 'theme_category', 'theme', 'max_participants', 'accommodation_type', 'optional_fee',
    'optional_programme', 'published', 'application_status', 'created_at', 'updated_at'
];

const FULL_FIELDS: (keyof SuEventFull)[] = [
    ...MINIMAL_FIELDS, 'photos', 'video', 'website', 'social_media', 'trainers', 'pax_description', 'pax_confirmation',
    'questions', 'accepted_participants', 'available_spots', 'open_call', 'activities_list', 'course_level', 'courses',
    'special_equipment', 'university_support', 'cancellation_rules', 'additional_regulation', 'application_starts',
    'application_ends'
];

const pick = <T>(full: SuEvent, fields: (keyof SuEvent)[]): T => Object.fromEntries(fields.map((field) => [field, full[field]])) as T;

// A fully published SU as members and visitors see it (in the list and on its page).
export const suEventFull = (overrides: Partial<SuEvent> = {}): SuEventFull => pick(suEvent(overrides), FULL_FIELDS);

// An SU published as minimal, as members and visitors see it.
export const suEventMinimal = (overrides: Partial<SuEvent> = {}): SuEventMinimal => pick(suEvent({ published: 'minimal', ...overrides }), MINIMAL_FIELDS);

// A row of `GET /mine/participating`: the minimal fields and the caller's application to it.
export interface SuParticipatingEvent extends SuEventMinimal {
    applications: { user_id: number; status: SuApplicationStatus }[];
}

export const suParticipatingEvent = (overrides: Partial<SuEvent> & { applications?: SuParticipatingEvent['applications'] } = {}): SuParticipatingEvent => {
    const { applications, ...event } = overrides;
    return {
        ...pick<SuEventMinimal>(suEvent(event), MINIMAL_FIELDS),
        applications: applications ?? [{ user_id: 2, status: 'pending' }]
    };
};

// What a board sees of the SU an application is for: the minimal fields without the
// application status, and the questions.
export interface SuBoardviewEvent extends Omit<SuEventMinimal, 'application_status'> {
    questions: SuQuestion[] | null;
}

export const suBoardviewEvent = (overrides: Partial<SuEvent> = {}): SuBoardviewEvent => pick(
    suEvent(overrides),
    [...MINIMAL_FIELDS.filter((field) => field !== 'application_status'), 'questions']
);

type PerType = Record<SuType, boolean>;
const byType = (value: boolean): PerType => Object.fromEntries(SU_TYPES.map((type) => [type, value])) as PerType;

export interface SuStatusPermissions {
    first_draft: boolean;
    first_approval: boolean;
    first_submission: boolean;
    second_draft: boolean;
    second_approval: boolean;
    second_submission: boolean;
}

// The `permissions` of `GET /single/:id` (getPermissions and getEventPermissions in
// summeruniversity/lib/helpers.js). By default a member who may apply, looking at a fully
// published SU with open applications.
export interface SuPermissions {
    approve_summeruniversity: PerType;
    manage_summeruniversity: PerType;
    apply_general: boolean;
    create_summeruniversity: boolean;
    manage_seasons: boolean;
    edit_su_type: boolean;
    edit_su_fee: boolean;
    // Keyed by the ids of the caller's bodies.
    set_board_comment: Record<string, boolean>;
    see_boardview: { global: boolean; [bodyId: string]: boolean };
    see_summeruniversity: boolean;
    edit_summeruniversity: boolean;
    delete_summeruniversity: boolean;
    // Only for a logged-in caller: pass `undefined` for a visitor.
    apply?: boolean;
    see_own_application?: boolean;
    list_applications: boolean;
    approve_participants: boolean;
    set_participants_cancelled: boolean;
    set_participants_attended: boolean;
    set_participants_confirmed: boolean;
    edit_summeruniversity_open_call: boolean;
    export_pax: boolean;
    change_status: SuStatusPermissions;
}

const noStatusChanges = (): SuStatusPermissions => ({
    first_draft: false,
    first_approval: false,
    first_submission: false,
    second_draft: false,
    second_approval: false,
    second_submission: false
});

export const suPermissions = (overrides: Partial<SuPermissions> = {}): SuPermissions => ({
    approve_summeruniversity: byType(false),
    manage_summeruniversity: byType(false),
    apply_general: true,
    create_summeruniversity: false,
    manage_seasons: false,
    edit_su_type: false,
    edit_su_fee: false,
    set_board_comment: { 1: false },
    see_boardview: { global: false, 1: false },
    see_summeruniversity: true,
    edit_summeruniversity: false,
    delete_summeruniversity: false,
    apply: true,
    see_own_application: false,
    list_applications: false,
    approve_participants: false,
    set_participants_cancelled: false,
    set_participants_attended: false,
    set_participants_confirmed: false,
    edit_summeruniversity_open_call: false,
    export_pax: false,
    change_status: noStatusChanges(),
    ...overrides
});

// The status changes of helpers.js for an SU in `status`, for an approver (`canApprove`) or an
// organiser.
const statusChanges = (status: SuStatus, canApprove: boolean): SuStatusPermissions => ({
    first_draft: status === 'first submission' && canApprove,
    first_approval: status === 'first submission' && canApprove,
    first_submission: (status === 'first approval' && canApprove) || status === 'first draft',
    second_draft: status === 'second submission' && canApprove,
    second_approval: status === 'second submission' && canApprove,
    second_submission: (status === 'second approval' && canApprove) || status === 'second draft' || status === 'first approval'
});

const organizerActions = {
    list_applications: true,
    approve_participants: true,
    set_participants_cancelled: true,
    set_participants_attended: true,
    set_participants_confirmed: true,
    edit_summeruniversity_open_call: true,
    export_pax: true
};

// An organiser of an SU in `status`, who doesn't apply to it. Organisers can't edit an SU in
// its second approval.
export const suOrganizerPermissions = (status: SuStatus = 'second approval', overrides: Partial<SuPermissions> = {}): SuPermissions => suPermissions({
    ...organizerActions,
    apply: false,
    edit_summeruniversity: status !== 'second approval',
    change_status: statusChanges(status, false),
    ...overrides
});

// A member of SUCT (the seed's `suct`): approves and manages SUs of `type`, creates SUs and
// manages seasons, without being an organiser.
export const suctPermissions = (status: SuStatus = 'second approval', type: SuType = 'regular', overrides: Partial<SuPermissions> = {}): SuPermissions => suPermissions({
    ...organizerActions,
    approve_summeruniversity: { ...byType(false), [type]: true },
    manage_summeruniversity: { ...byType(false), [type]: true },
    create_summeruniversity: true,
    manage_seasons: true,
    edit_su_type: true,
    edit_su_fee: true,
    see_boardview: { global: true, 1: false },
    apply: false,
    edit_summeruniversity: true,
    delete_summeruniversity: true,
    change_status: statusChanges(status, true),
    ...overrides
});

// The `permissions` of `GET /single/:id/applications/:application_id`. By default the
// applicant, while they may apply.
export interface SuApplicationPermissions extends SuPermissions {
    view_application: boolean;
    edit_application: boolean;
    set_application_cancelled: boolean;
}

export const suApplicationPermissions = (overrides: Partial<SuApplicationPermissions> = {}): SuApplicationPermissions => ({
    ...suPermissions({ see_own_application: true }),
    view_application: true,
    edit_application: true,
    set_application_cancelled: true,
    ...overrides
});

// The columns of an application but the board comment.
export interface SuApplicationFields {
    id: number;
    user_id: number;
    event_id: number;
    first_name: string;
    last_name: string;
    nationality: string;
    travelling_from: string;
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
    body_id: number;
    body_name: string;
    status: SuApplicationStatus;
    confirmed: boolean;
    attended: boolean;
    cancelled: boolean;
    aegee_experience: string;
    ideal_su: string;
    motivation: string;
    // One answer per question of the SU.
    answers: string[];
    meals: string;
    allergies: string | null;
    agreed_to_privacy_policy: boolean;
    agreed_to_su_terms: boolean;
    created_at: string;
    updated_at: string;
}

const applicationFields = (overrides: Partial<SuApplicationFields>): SuApplicationFields => ({
    id: id(),
    user_id: 2,
    event_id: 1,
    first_name: 'Alex',
    last_name: 'Member',
    nationality: 'Belgium',
    travelling_from: 'Ghent',
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
    body_id: 1,
    body_name: 'AEGEE-Antenna',
    status: 'pending',
    confirmed: false,
    attended: false,
    cancelled: false,
    aegee_experience: 'Two local trainings',
    ideal_su: 'Mountains and new friends',
    motivation: 'I want to learn a language',
    answers: ['Because of the mountains'],
    meals: 'Vegetarian',
    allergies: null,
    agreed_to_privacy_policy: true,
    agreed_to_su_terms: true,
    created_at: iso(-3),
    updated_at: iso(-2),
    ...overrides
});

// Filled visa fields, for an application with `visa_required: true`.
export const VISA_DETAILS = {
    visa_required: true,
    visa_place_of_birth: 'Testville',
    visa_passport_number: 'X0000000',
    visa_passport_issue_date: date(-400),
    visa_passport_expiration_date: date(2000),
    visa_passport_issue_authority: 'Test authority',
    visa_embassy: 'Test embassy',
    visa_street_and_house: 'Example street 1',
    visa_postal_code: '0000',
    visa_city: 'Testville',
    visa_country: 'Testland'
} satisfies Partial<SuApplicationFields>;

// One application with the applicant's details from core (`GET
// /single/:id/applications/:application_id`). The applicant's own (`/applications/me`) has no
// `board_comment`; organisers and boards get it: pass it for them.
export interface SuApplication extends SuApplicationFields {
    gender: string | null;
    date_of_birth: string | null;
    notification_email: string | null;
    board_comment?: string | null;
}

export const suApplication = (overrides: Partial<SuApplication> = {}): SuApplication => {
    const { gender, date_of_birth: dateOfBirth, notification_email: notificationEmail, board_comment: boardComment, ...fields } = overrides;
    return {
        ...applicationFields(fields),
        gender: gender === undefined ? 'neutral' : gender,
        date_of_birth: dateOfBirth === undefined ? '1999-05-01' : dateOfBirth,
        notification_email: notificationEmail === undefined ? 'alex.member@example.org' : notificationEmail,
        ...(boardComment === undefined ? {} : { board_comment: boardComment })
    };
};

// A row of `GET /single/:id/applications`: the columns, with the board comment, without the
// applicant's details from core.
export interface SuParticipantRow extends SuApplicationFields {
    board_comment: string | null;
}

export const suParticipantRow = (overrides: Partial<SuParticipantRow> = {}): SuParticipantRow => {
    const { board_comment: boardComment, ...fields } = overrides;
    return { ...applicationFields(fields), board_comment: boardComment === undefined ? null : boardComment };
};

// A row of `GET /boardview/:body_id`: an application from the body with its SU.
export interface SuBoardviewApplication extends SuParticipantRow {
    event: SuBoardviewEvent;
}

export const suBoardviewApplication = (overrides: Partial<Omit<SuBoardviewApplication, 'event'>> & { event?: Partial<SuEvent> } = {}): SuBoardviewApplication => {
    const { event, ...row } = overrides;
    const su = suBoardviewEvent(event);
    return { ...suParticipantRow({ event_id: su.id, ...row }), event: su };
};

export interface SuStatsCount {
    type: string;
    value: number;
}

// `GET /applications?season=<year>`: applications per SU (by its name), applicants per body
// and nationality, and three totals.
export interface SuStats {
    by_event: SuStatsCount[];
    by_body: SuStatsCount[];
    by_nationality: SuStatsCount[];
    by_status: { type: 'total_applications' | 'total_members' | 'confirmed'; value: number }[];
}

export const suStats = (overrides: Partial<SuStats> = {}): SuStats => ({
    by_event: [{ type: 'Summer University in the mountains', value: 3 }],
    by_body: [{ type: 'AEGEE-Antenna', value: 2 }],
    by_nationality: [{ type: 'Belgium', value: 2 }],
    by_status: [
        { type: 'total_applications', value: 3 },
        { type: 'total_members', value: 2 },
        { type: 'confirmed', value: 1 }
    ],
    ...overrides
});
