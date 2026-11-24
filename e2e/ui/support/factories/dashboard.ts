// Factories for what the dashboard and the events calendar read from events, statutory and
// summeruniversity. Only these pages read these answers (the member's applied events, the latest
// statutory event and the calendar's lists), so they are kept here rather than in the files of
// those areas. See base.ts for the rules.
import { id, iso } from './base.ts';
import { eventSummary, type EventSummary } from './events.ts';

// Exports of this file that don't build an entity of their own, so they need no contract
// check (scripts/check-factory-contracts.ts): the calendar file is Google's format, not a service's.
export const NOT_ENTITIES = ['ics'];

// An event of `GET events /mine/participating`: the list fields, and the member's application.
export interface AppliedEvent extends EventSummary {
    applications: { user_id: number; status: 'pending' | 'accepted' | 'rejected' }[];
}

export const appliedEvent = (overrides: Partial<AppliedEvent> = {}): AppliedEvent => {
    const { applications, ...fields } = overrides;
    return {
        ...eventSummary(fields),
        applications: applications ?? [{ user_id: 2, status: 'pending' }]
    };
};

export type StatutoryType = 'agora' | 'epm' | 'spm';

// A published statutory event as `GET statutory /` lists it: every column of the model and its
// computed flags. By default an Agora that is open for applications.
export interface StatutoryEvent {
    id: number;
    name: string;
    url: string;
    type: StatutoryType;
    status: 'draft' | 'published';
    description: string;
    body_id: number;
    fee: number;
    starts: string;
    ends: string;
    application_period_starts: string;
    application_period_ends: string;
    board_approve_deadline: string;
    participants_list_publish_deadline: string;
    memberslist_submission_deadline: string | null;
    vegetarian: boolean;
    can_apply: boolean;
    can_approve_members: boolean;
    can_see_participants_list: boolean;
    can_upload_memberslist: boolean;
    can_edit_memberslist: boolean;
    created_at: string;
    updated_at: string;
}

export const statutoryEvent = (overrides: Partial<StatutoryEvent> = {}): StatutoryEvent => {
    const eventId = overrides.id ?? id();
    return {
        id: eventId,
        name: `Agora ${eventId}`,
        url: `agora-${eventId}`,
        type: 'agora',
        status: 'published',
        description: 'The **general assembly** of AEGEE.',
        body_id: 1,
        fee: 0,
        starts: iso(20),
        ends: iso(24),
        application_period_starts: iso(-1),
        application_period_ends: iso(10),
        board_approve_deadline: iso(11),
        participants_list_publish_deadline: iso(12),
        memberslist_submission_deadline: iso(13),
        vegetarian: false,
        can_apply: true,
        can_approve_members: true,
        can_see_participants_list: false,
        can_upload_memberslist: true,
        can_edit_memberslist: true,
        created_at: iso(-30),
        updated_at: iso(-2),
        ...overrides
    };
};

// What statutory says the member may do with an event (`permissions` of
// `GET statutory /events/:id`), here for a member who may apply and nothing else.
export interface StatutoryPermissions {
    edit_event: boolean;
    change_event_status: boolean;
    delete_event: boolean;
    apply: boolean;
    use_massmailer: boolean;
    manage_applications: boolean;
    manage_incoming: boolean;
    manage_juridical: boolean;
    see_applications: boolean;
    see_participants_list: boolean;
}

export const statutoryPermissions = (overrides: Partial<StatutoryPermissions> = {}): StatutoryPermissions => ({
    edit_event: false,
    change_event_status: false,
    delete_event: false,
    apply: true,
    use_massmailer: false,
    manage_applications: false,
    manage_incoming: false,
    manage_juridical: false,
    see_applications: false,
    see_participants_list: false,
    ...overrides
});

// `GET statutory /events/latest`: the published statutory event that starts last, with what
// the member may do with it.
export interface LatestStatutoryEvent extends StatutoryEvent {
    permissions: StatutoryPermissions;
}

export const latestStatutoryEvent = (overrides: Partial<LatestStatutoryEvent> = {}): LatestStatutoryEvent => {
    const { permissions, ...fields } = overrides;
    return { ...statutoryEvent(fields), permissions: permissions ?? statutoryPermissions() };
};

// An event of `GET statutory /mine`: the event, and the member's application.
export interface AppliedStatutoryEvent extends StatutoryEvent {
    applications: { user_id: number; cancelled: boolean; status: 'pending' | 'accepted' | 'rejected' }[];
}

export const appliedStatutoryEvent = (overrides: Partial<AppliedStatutoryEvent> = {}): AppliedStatutoryEvent => {
    const { applications, ...fields } = overrides;
    return {
        ...statutoryEvent(fields),
        applications: applications ?? [{ user_id: 2, cancelled: false, status: 'pending' }]
    };
};

export type SummerUniversityType = 'regular' | 'pilot';

// A Summer University with the fields that are public once it is published
// (EVENT_MINIMAL_FIELDS in summeruniversity/lib/constants.js): what `GET summeruniversity /`
// lists for most of them.
export interface SummerUniversity {
    id: number;
    name: string;
    // Not required before the Summer University is published.
    url: string | null;
    season: number;
    image: string | null;
    description: string;
    email: string;
    starts: string;
    ends: string;
    fee: number;
    organizing_bodies: { body_id: number; body_name: string }[];
    locations: { name: string; position: { lat: number; lng: number }; start?: boolean; end?: boolean }[];
    type: SummerUniversityType;
    theme_category: string;
    theme: string;
    max_participants: number;
    accommodation_type: string;
    optional_fee: number | null;
    optional_programme: string | null;
    published: 'minimal' | 'full';
    application_status: 'open' | 'closed';
    created_at: string;
    updated_at: string;
}

export const summerUniversity = (overrides: Partial<SummerUniversity> = {}): SummerUniversity => {
    const eventId = overrides.id ?? id();
    return {
        id: eventId,
        name: `Summer University ${eventId}`,
        url: `su-${eventId}`,
        season: new Date(iso(60)).getFullYear(),
        image: null,
        description: 'Two weeks of **culture** and friends.',
        email: `su-${eventId}@example.com`,
        starts: iso(60),
        ends: iso(74),
        fee: 150,
        organizing_bodies: [{ body_id: 1, body_name: 'AEGEE-Antenna' }],
        locations: [{ name: 'Brussels', position: { lat: 50.85, lng: 4.35 }, start: true, end: true }],
        type: 'regular',
        theme_category: 'local_culture',
        theme: 'Discovering the city',
        max_participants: 30,
        accommodation_type: 'Hostel',
        optional_fee: null,
        optional_programme: null,
        published: 'minimal',
        application_status: 'open',
        created_at: iso(-90),
        updated_at: iso(-5),
        ...overrides
    };
};

// An event of `GET summeruniversity /mine/participating`: the public fields, and the member's
// application (without `cancelled`, which summeruniversity doesn't send here).
export interface AppliedSummerUniversity extends SummerUniversity {
    applications: { user_id: number; status: 'pending' | 'accepted' | 'rejected' }[];
}

export const appliedSummerUniversity = (overrides: Partial<AppliedSummerUniversity> = {}): AppliedSummerUniversity => {
    const { applications, ...fields } = overrides;
    return {
        ...summerUniversity(fields),
        applications: applications ?? [{ user_id: 2, status: 'pending' }]
    };
};

export interface IcsEvent {
    summary: string;
    // UTC instants: '2026-03-18T17:00:00Z'.
    start: string;
    end: string;
    description?: string;
    uid?: string;
}

const icsDate = (instant: string): string => new Date(instant).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (text: string): string => text.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

// The online events calendar as Google Calendar publishes it (`basic.ics`): a VCALENDAR with a
// VTIMEZONE block first and one VEVENT per event. `{ timezone: false }` leaves the VTIMEZONE out.
export const ics = (events: IcsEvent[], { timezone = true }: { timezone?: boolean } = {}): string => {
    const lines = [
        'BEGIN:VCALENDAR',
        'PRODID:-//Google Inc//Google Calendar 70.9054//EN',
        'VERSION:2.0',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:AEGEE online events',
        'X-WR-TIMEZONE:Europe/Brussels',
        ...(timezone ? [
            'BEGIN:VTIMEZONE',
            'TZID:Europe/Brussels',
            'X-LIC-LOCATION:Europe/Brussels',
            'BEGIN:DAYLIGHT',
            'TZOFFSETFROM:+0100',
            'TZOFFSETTO:+0200',
            'TZNAME:CEST',
            'DTSTART:19700329T020000',
            'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
            'END:DAYLIGHT',
            'BEGIN:STANDARD',
            'TZOFFSETFROM:+0200',
            'TZOFFSETTO:+0100',
            'TZNAME:CET',
            'DTSTART:19701025T030000',
            'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
            'END:STANDARD',
            'END:VTIMEZONE'
        ] : []),
        ...events.flatMap((event, index) => [
            'BEGIN:VEVENT',
            `DTSTART:${icsDate(event.start)}`,
            `DTEND:${icsDate(event.end)}`,
            `DTSTAMP:${icsDate(event.start)}`,
            `UID:${event.uid ?? `online-${index + 1}@google.com`}`,
            `SUMMARY:${icsText(event.summary)}`,
            ...(event.description === undefined ? [] : [`DESCRIPTION:${icsText(event.description)}`]),
            'STATUS:CONFIRMED',
            'END:VEVENT'
        ]),
        'END:VCALENDAR'
    ];
    return `${lines.join('\r\n')}\r\n`;
};
