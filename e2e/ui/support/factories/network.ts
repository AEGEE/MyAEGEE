// Factories for what the network service answers. See base.ts for the rules.
import { date, id, iso } from './base.ts';

export interface BoardMember {
    user_id: number;
    // The position, as typed in: 'PR responsible'.
    function: string;
}

// A board of a body (`GET network /boards`, `GET network /bodies/:id/boards`). The president,
// secretary and treasurer are user ids; the dates have no time.
export interface Board {
    id: number;
    body_id: number;
    name: string | null;
    elected_date: string;
    start_date: string;
    end_date: string | null;
    president: number;
    secretary: number;
    treasurer: number;
    other_members: BoardMember[] | null;
    message: string | null;
    image_id: number | null;
    new_board_email_sent_at: string | null;
    created_at: string;
    updated_at: string;
}

// By default the current board: elected two months ago, in office for a year since last month.
export const board = (overrides: Partial<Board> = {}): Board => ({
    id: id(),
    body_id: 1,
    name: null,
    elected_date: date(-60),
    start_date: date(-30),
    end_date: date(335),
    president: 1,
    secretary: 2,
    treasurer: 3,
    other_members: [],
    message: null,
    image_id: null,
    new_board_email_sent_at: iso(-30),
    created_at: iso(-60),
    updated_at: iso(-30),
    ...overrides
});

// Exports of this file that don't build an entity of their own, so they need no contract
// check (scripts/check-factory-contracts.ts).
export const NOT_ENTITIES = ['allMailComponents'];

// The latest board election of a body up to a day (`GET network /boards/recents?ends=`).
export interface RecentBoardElection {
    body_id: number;
    // A date without a time.
    latest_election: string;
}

export const recentBoardElection = (overrides: Partial<RecentBoardElection> = {}): RecentBoardElection => ({
    body_id: 1,
    latest_election: date(-60),
    ...overrides
});

// The Network Commissioner a body is assigned to (`GET network /netcom`): `netcom_id` is the
// commissioner's user id.
export interface NetcomAssignment {
    body_id: number;
    netcom_id: number;
    created_at: string;
    updated_at: string;
}

export const netcomAssignment = (overrides: Partial<NetcomAssignment> = {}): NetcomAssignment => ({
    body_id: 1,
    netcom_id: 4,
    created_at: iso(-100),
    updated_at: iso(-10),
    ...overrides
});

export type AntennaCriterionName = 'communication' | 'board election' | 'members list' | 'membership fee' | 'events' | 'agora attendance' | 'development plan' | 'fulfilment report';

// A criterion set by hand for a body and an Agora (`GET network /antennaCriteria/:agora_id`).
// The value is a string; null means "not set".
export interface AntennaCriterion {
    agora_id: number;
    body_id: number;
    antenna_criterion: AntennaCriterionName;
    value: 'true' | 'false' | 'exception' | null;
    comment: string | null;
    created_at: string;
    updated_at: string;
}

export const antennaCriterion = (overrides: Partial<AntennaCriterion> = {}): AntennaCriterion => ({
    agora_id: 1,
    body_id: 1,
    antenna_criterion: 'communication',
    value: 'true',
    comment: 'Answers the mails of the Network Commission',
    created_at: iso(-20),
    updated_at: iso(-5),
    ...overrides
});

export type MailComponentName = 'introduction' | 'communication' | 'board election' | 'members list' | 'membership fee' | 'events' | 'agora attendance' | 'development plan' | 'fulfilment report' | 'closing';

export const MAIL_COMPONENTS: MailComponentName[] = ['introduction', 'communication', 'board election', 'members list', 'membership fee', 'events', 'agora attendance', 'development plan', 'fulfilment report', 'closing'];

// One part of the fulfilment mail of an Agora (`GET network /mailComponent/:agora_id`).
export interface MailComponent {
    agora_id: number;
    mail_component: MailComponentName;
    text: string;
    created_at: string;
    updated_at: string;
}

export const mailComponent = (overrides: Partial<MailComponent> = {}): MailComponent => ({
    agora_id: 1,
    mail_component: 'introduction',
    text: 'Dear board of {body_name},',
    created_at: iso(-30),
    updated_at: iso(-30),
    ...overrides
});

// All ten parts of an Agora's mail: "<part> text" unless `texts` says otherwise.
export const allMailComponents = (agoraId: number, texts: Partial<Record<MailComponentName, string>> = {}): MailComponent[] => MAIL_COMPONENTS
    .map((name) => mailComponent({ agora_id: agoraId, mail_component: name, text: texts[name] ?? `${name} text` }));

// What the other services answer to the Antenna Criteria page. Only that page reads these, so
// they are here rather than in the files of the services' own areas.

// The end of the latest published European event per group of organising bodies
// (`GET events /recents?ends=`).
export interface NetworkRecentEvent {
    organizing_bodies: { body_id: number }[];
    latest_event: string;
}

export const networkRecentEvent = (overrides: Partial<NetworkRecentEvent> = {}): NetworkRecentEvent => ({
    organizing_bodies: [{ body_id: 1 }],
    latest_event: iso(-100),
    ...overrides
});

// The end of the latest published statutory event per organising body (`GET statutory /recents?ends=`).
export interface NetworkRecentStatutoryEvent {
    body_id: number;
    latest_event: string;
}

export const networkRecentStatutoryEvent = (overrides: Partial<NetworkRecentStatutoryEvent> = {}): NetworkRecentStatutoryEvent => ({
    body_id: 1,
    latest_event: iso(-100),
    ...overrides
});

// The end of the latest fully published Summer University per group of organising bodies
// (`GET summeruniversity /recents?ends=`).
export interface NetworkRecentSummerUniversity {
    organizing_bodies: { body_id: number }[];
    latest_event: string;
}

export const networkRecentSummerUniversity = (overrides: Partial<NetworkRecentSummerUniversity> = {}): NetworkRecentSummerUniversity => ({
    organizing_bodies: [{ body_id: 1 }],
    latest_event: iso(-200),
    ...overrides
});
