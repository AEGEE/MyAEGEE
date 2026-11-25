// Factories for the events of the statutory service (Agorae, EPMs, SPMs) and the permissions
// it computes for them. See base.ts for the rules.
//
// The statutory area splits its factories over four files: this one (events, permissions,
// pax limits, tasks), statutory-applications.ts, statutory-candidates.ts (positions,
// candidates, plenaries, question lines) and statutory-memberslists.ts (members lists, votes,
// statistics, field lists).
import { DAY, iso } from './base.ts';

export type StatutoryEventType = 'agora' | 'epm' | 'spm';
const EVENT_TYPES: StatutoryEventType[] = ['agora', 'epm', 'spm'];

export interface StatutoryQuestion {
    type: 'string' | 'text' | 'number' | 'checkbox' | 'select';
    description: string;
    required: boolean;
    values?: string[];
}

export interface StatutoryLocation {
    name: string;
    position: { lat: number; lng: number };
}

// The event's picture (models/Image.js). The folder on the server and the uploader are not part
// of what clients get (statutory PR #2405); the frontend reads `frontend_path` only.
export interface StatutoryImage {
    id: number;
    file_name: string;
    frontend_path: string;
    created_at: string;
    updated_at: string;
}

export const statutoryImage = (overrides: Partial<StatutoryImage> = {}): StatutoryImage => ({
    id: 3,
    file_name: 'agora-logo.png',
    frontend_path: '/agora-logo.png',
    created_at: iso(-20),
    updated_at: iso(-20),
    ...overrides
});

// An event as GET /api/statutory/ lists it (models/Event.js, with its virtual fields).
export interface StatutoryEventSummary {
    id: number;
    name: string;
    url: string;
    description: string;
    type: StatutoryEventType;
    status: 'draft' | 'published';
    body_id: number;
    image_id: number | null;
    image: StatutoryImage | null;
    fee: number;
    vegetarian: boolean;
    booklet_folder: string | null;
    locations: StatutoryLocation[];
    questions: StatutoryQuestion[];
    previous_agora_id: number | null;
    publication_date: string | null;
    application_status_revealed_at: string | null;
    application_period_starts: string;
    application_period_ends: string;
    board_approve_deadline: string;
    participants_list_publish_deadline: string;
    memberslist_submission_deadline: string | null;
    draft_proposal_deadline: string | null;
    final_proposal_deadline: string | null;
    candidature_deadline: string | null;
    booklet_publication_deadline: string | null;
    updated_booklet_publication_deadline: string | null;
    starts: string;
    ends: string;
    // Virtual fields, computed from the dates and the server's "now".
    memberslist_edit_deadline: string;
    can_apply: boolean;
    can_approve_members: boolean;
    can_see_participants_list: boolean;
    can_upload_memberslist: boolean;
    can_edit_memberslist: boolean;
    created_at: string;
    updated_at: string;
}

// What GET /api/statutory/events/:id answers: the event with the viewer's permissions in it.
export interface StatutoryEvent extends StatutoryEventSummary {
    permissions: StatutoryEventPermissions;
}

type PerBody = Record<string, boolean> & { global: boolean };

// The `permissions` of an event (statutory/lib/helpers.js, getPermissions and
// getEventPermissions). Every key is always there; the per-body ones have `global` plus one key
// per body of the viewer.
export interface StatutoryEventPermissions {
    create_event: Record<StatutoryEventType, boolean>;
    edit_pax_limits: Record<StatutoryEventType, boolean>;
    see_background_tasks: boolean;
    edit_event: boolean;
    change_event_status: boolean;
    delete_event: boolean;
    apply: boolean;
    use_massmailer: boolean;
    manage_applications: boolean;
    manage_incoming: boolean;
    manage_juridical: boolean;
    see_applications: boolean;
    see_applications_juridical: boolean;
    see_applications_incoming: boolean;
    see_applications_network: boolean;
    see_participants_list: boolean;
    export: { openslides: boolean; all: boolean; incoming: boolean; delegates_jc: boolean };
    set_board_comment_and_participant_type: PerBody;
    see_boardview: PerBody;
    upload_memberslist: PerBody;
    edit_memberslist: PerBody;
    see_memberslist: PerBody;
    see_missing_memberslist: { global: boolean };
    see_memberslist_without_fee: { global: boolean };
    set_memberslists_fee_paid: boolean;
    manage_candidates: boolean;
    manage_plenaries: boolean;
    see_plenaries: boolean;
    mark_attendance: boolean;
    apply_from_body: Record<string, boolean>;
    manage_question_lines: boolean;
    see_question_lines: boolean;
    see_questions: boolean;
    submit_questions: boolean;
}

const byType = (value: boolean): Record<StatutoryEventType, boolean> => ({ agora: value, epm: value, spm: value });

// What a member without any statutory permission gets for a published event in its application
// period, as a member of body 1 (whose default pax limit lets them apply).
export const statutoryEventPermissions = (overrides: Partial<StatutoryEventPermissions> = {}): StatutoryEventPermissions => ({
    create_event: byType(false),
    edit_pax_limits: byType(false),
    see_background_tasks: false,
    edit_event: false,
    change_event_status: false,
    delete_event: false,
    apply: true,
    use_massmailer: false,
    manage_applications: false,
    manage_incoming: false,
    manage_juridical: false,
    see_applications: false,
    see_applications_juridical: false,
    see_applications_incoming: false,
    see_applications_network: false,
    see_participants_list: false,
    export: { openslides: false, all: false, incoming: false, delegates_jc: false },
    set_board_comment_and_participant_type: { global: false, 1: false },
    see_boardview: { global: false, 1: false },
    upload_memberslist: { global: false, 1: false },
    edit_memberslist: { global: false, 1: false },
    see_memberslist: { global: false, 1: false },
    see_missing_memberslist: { global: false },
    see_memberslist_without_fee: { global: false },
    set_memberslists_fee_paid: false,
    manage_candidates: false,
    manage_plenaries: false,
    see_plenaries: false,
    mark_attendance: false,
    apply_from_body: { 1: true },
    manage_question_lines: false,
    see_question_lines: false,
    see_questions: false,
    submit_questions: false,
    ...overrides
});

// Every permission, for body 1: what a superadmin gets during the application period.
export const allStatutoryPermissions = (overrides: Partial<StatutoryEventPermissions> = {}): StatutoryEventPermissions => statutoryEventPermissions({
    create_event: byType(true),
    edit_pax_limits: byType(true),
    see_background_tasks: true,
    edit_event: true,
    change_event_status: true,
    delete_event: true,
    apply: true,
    use_massmailer: true,
    manage_applications: true,
    manage_incoming: true,
    manage_juridical: true,
    see_applications: true,
    see_applications_juridical: true,
    see_applications_incoming: true,
    see_applications_network: true,
    see_participants_list: true,
    export: { openslides: true, all: true, incoming: true, delegates_jc: true },
    set_board_comment_and_participant_type: { global: true, 1: true },
    see_boardview: { global: true, 1: true },
    upload_memberslist: { global: true, 1: true },
    edit_memberslist: { global: true, 1: true },
    see_memberslist: { global: true, 1: true },
    see_missing_memberslist: { global: true },
    see_memberslist_without_fee: { global: true },
    set_memberslists_fee_paid: true,
    manage_candidates: true,
    manage_plenaries: true,
    see_plenaries: true,
    mark_attendance: true,
    apply_from_body: { 1: true },
    manage_question_lines: true,
    see_question_lines: true,
    see_questions: true,
    submit_questions: true,
    ...overrides
});

// The holder of global:manage_event:<type> (organisers of the statutory events): edit, publish
// and delete the event. Nothing about applications.
export const statutoryOrganiserPermissions = (overrides: Partial<StatutoryEventPermissions> = {}): StatutoryEventPermissions => statutoryEventPermissions({
    create_event: byType(true),
    edit_pax_limits: byType(true),
    edit_event: true,
    change_event_status: true,
    delete_event: true,
    ...overrides
});

// The holder of global:manage_applications:<type>: everything about applications.
export const statutoryManagerPermissions = (overrides: Partial<StatutoryEventPermissions> = {}): StatutoryEventPermissions => statutoryEventPermissions({
    apply: true,
    manage_applications: true,
    see_applications: true,
    see_applications_juridical: true,
    see_applications_incoming: true,
    see_applications_network: true,
    see_participants_list: true,
    export: { openslides: true, all: true, incoming: true, delegates_jc: false },
    ...overrides
});

const toIso = (time: number): string => new Date(time).toISOString();

export interface StatutoryEventOptions {
    // The instant the server computed the virtual fields at (can_apply, …). Defaults to the
    // instant the factories date from: the real now, or the one `withNow()` sets. A spec that
    // freezes the page's clock builds its event with the same instant.
    now?: number;
}

const AGORA_ONLY = [
    'memberslist_submission_deadline', 'draft_proposal_deadline', 'final_proposal_deadline',
    'candidature_deadline', 'booklet_publication_deadline', 'updated_booklet_publication_deadline'
] as const;

// An Agora in its application period, as the summary of the list. Its virtual fields follow
// from its dates (models/Event.js), so moving a deadline in the overrides gives a consistent
// event. An EPM or SPM (`type: 'epm'`) has no Agora-only deadlines.
export const statutoryEventSummary = (overrides: Partial<StatutoryEventSummary> = {}, { now }: StatutoryEventOptions = {}): StatutoryEventSummary => {
    const at = now ?? Date.parse(iso(0));
    const day = (offset: number): string => iso(offset, at);
    const type = overrides.type ?? 'agora';
    const eventId = overrides.id ?? 1;
    const dates = {
        application_period_starts: day(-9),
        application_period_ends: day(5),
        board_approve_deadline: day(10),
        participants_list_publish_deadline: day(15),
        memberslist_submission_deadline: day(21) as string | null,
        draft_proposal_deadline: day(-5) as string | null,
        final_proposal_deadline: day(10) as string | null,
        candidature_deadline: day(26) as string | null,
        booklet_publication_deadline: day(26) as string | null,
        updated_booklet_publication_deadline: day(35) as string | null,
        starts: day(41),
        ends: day(46)
    };
    if (type !== 'agora') for (const key of AGORA_ONLY) dates[key] = null;

    const merged = { ...dates, ...overrides };
    const time = (value: string | null | undefined): number => (value ? Date.parse(value) : NaN);
    const between = (from: string | null | undefined, to: string | null | undefined): boolean => at >= time(from) && at <= time(to);
    const editDeadline = toIso(time(merged.starts) - 14 * DAY);

    return {
        id: eventId,
        name: type === 'agora' ? 'Agora Spring' : `${type.toUpperCase()} Spring`,
        url: type === 'agora' ? 'agora-spring' : `${type}-spring`,
        description: 'The **Spring Agora** of the network.',
        type,
        status: 'published',
        body_id: 1,
        image_id: null,
        image: null,
        fee: 75,
        vegetarian: false,
        booklet_folder: 'https://wiki.example.org/agora',
        locations: [],
        questions: [{ type: 'string', description: 'Why do you want to go?', required: true }],
        previous_agora_id: null,
        publication_date: day(-10),
        application_status_revealed_at: null,
        ...dates,
        memberslist_edit_deadline: editDeadline,
        can_apply: between(merged.application_period_starts, merged.application_period_ends),
        can_approve_members: between(merged.application_period_starts, merged.board_approve_deadline),
        can_see_participants_list: at > time(merged.participants_list_publish_deadline),
        can_upload_memberslist: between(merged.application_period_starts, merged.memberslist_submission_deadline),
        can_edit_memberslist: between(merged.application_period_starts, editDeadline),
        created_at: day(-30),
        updated_at: day(-10),
        ...overrides
    };
};

// One event with the viewer's permissions, as GET /api/statutory/events/:id answers it.
export const statutoryEvent = (overrides: Partial<StatutoryEvent> = {}, options: StatutoryEventOptions = {}): StatutoryEvent => {
    const { permissions, ...rest } = overrides;
    return {
        ...statutoryEventSummary(rest, options),
        permissions: permissions ?? statutoryEventPermissions()
    };
};

// The three event types, for specs that go through each of them.
export const STATUTORY_EVENT_TYPES = EVENT_TYPES;

// Builders that make no entity of their own (see scripts/check-factory-contracts.ts).
export const NOT_ENTITIES = ['statutoryTasks'];

// What PUT /api/statutory/events/:id/status answers (lib/events.js, changeEventStatus).
export const statusChangeResult = (): { success: true; message: string } => ({
    success: true,
    message: 'Event status was changed successfully.'
});

// What POST /api/statutory/events/:id/massmailer answers (lib/massmailer.js): how many mails
// went out.
export const massmailerResult = (sent = 3): { success: true; message: string; meta: { sent: number } } => ({
    success: true,
    message: 'Mail was sent successfully.',
    meta: { sent }
});

// The participants limit of a body for an event type (models/PaxLimit.js). `null` is
// unlimited. `default` says whether the limit is the generated one (not stored).
export interface PaxLimit {
    id: number | null;
    body_id: number;
    event_type: StatutoryEventType;
    delegate: number | null;
    envoy: number | null;
    observer: number | null;
    visitor: number | null;
    default: boolean;
    created_at?: string;
    updated_at?: string;
}

// A limit stored for one body, as GET /api/statutory/limits/:type lists it for a body with a
// custom limit, and as POST /api/statutory/limits/:type answers.
export const paxLimit = (overrides: Partial<PaxLimit> = {}): PaxLimit => ({
    id: 7,
    body_id: 1,
    event_type: 'agora',
    delegate: 3,
    envoy: 0,
    observer: 0,
    visitor: 30,
    default: false,
    created_at: iso(-40),
    updated_at: iso(-40),
    ...overrides
});

type LimitValues = Pick<PaxLimit, 'delegate' | 'envoy' | 'observer' | 'visitor'>;

// The default limits per body type (models/PaxLimit.js, defaultLimitForAgora and
// defaultLimitForEPM). An EPM and an SPM have the same ones.
const DEFAULT_LIMITS: Record<'agora' | 'other', Record<string, LimitValues>> = {
    agora: {
        partner: { delegate: 0, envoy: 3, visitor: 0, observer: 0 },
        antenna: { delegate: 3, envoy: 0, visitor: 30, observer: 0 },
        'contact antenna': { delegate: 0, envoy: 3, visitor: 30, observer: 0 },
        contact: { delegate: 0, envoy: 0, visitor: 0, observer: null },
        'working group': { delegate: 0, envoy: 3, visitor: 30, observer: 0 },
        committee: { delegate: 0, envoy: 3, visitor: 30, observer: 0 },
        project: { delegate: 0, envoy: 3, visitor: 30, observer: 0 },
        'interest group': { delegate: 0, envoy: 0, visitor: 30, observer: 0 }
    },
    other: {
        antenna: { delegate: 0, envoy: null, visitor: 0, observer: 0 },
        'contact antenna': { delegate: 0, envoy: null, visitor: 0, observer: 0 },
        contact: { delegate: 0, envoy: null, visitor: 0, observer: 0 }
    }
};
const NO_ONE: LimitValues = { delegate: 0, envoy: 0, visitor: 0, observer: 0 };

// The generated limit of a body that has no custom one, as GET /api/statutory/limits/:type and
// /limits/:type/defaults list it: `defaultPaxLimit({ id: 1, type: 'antenna' })`.
export const defaultPaxLimit = (body: { id: number; type: string } = { id: 1, type: 'antenna' }, eventType: StatutoryEventType = 'agora'): PaxLimit => ({
    id: null,
    body_id: body.id,
    event_type: eventType,
    ...(DEFAULT_LIMITS[eventType === 'agora' ? 'agora' : 'other'][body.type] ?? NO_ONE),
    default: true
});

// A job the statutory service has scheduled (lib/cron.js): opening or closing the applications
// of a position, or closing the attendance of a plenary. `params.id` is the position or plenary.
export interface StatutoryTask {
    id: number;
    key: 'CLOSE_ATTENDANCES' | 'OPEN_POSITION_APPLICATIONS' | 'CLOSE_POSITION_APPLICATIONS';
    description: string;
    time: string;
    params: { id: number };
}

const TASK_DESCRIPTIONS: Record<StatutoryTask['key'], string> = {
    CLOSE_ATTENDANCES: 'Closing plenary attendance',
    OPEN_POSITION_APPLICATIONS: 'Open position application deadline',
    CLOSE_POSITION_APPLICATIONS: 'Close position application deadline'
};

export const statutoryTask = (overrides: Partial<StatutoryTask> = {}): StatutoryTask => {
    const key = overrides.key ?? 'CLOSE_POSITION_APPLICATIONS';
    return {
        id: 1,
        key,
        description: TASK_DESCRIPTIONS[key],
        time: iso(10),
        params: { id: 5 },
        ...overrides
    };
};

// What GET /api/statutory/tasks answers: the jobs keyed by their id.
export const statutoryTasks = (...tasks: StatutoryTask[]): Record<string, StatutoryTask> => Object.fromEntries(tasks.map((task) => [String(task.id), task]));
