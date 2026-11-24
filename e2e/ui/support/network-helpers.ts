// What the specs of the Antenna Criteria page (ui/network/antenna-criteria-check*.spec.ts)
// share: the data of a check, the answers of the five services the page asks, and the
// permissions of the people who use it.
import type { Locator, Page } from '@playwright/test';

import type { ApiMock, Responder } from './api-mock.ts';
import { id, iso, ok } from './factories/base.ts';
import { body, bodyMembership, permission, seedPermissions, type Body, type BodyMembership, type Permission } from './factories/core.ts';
import { dashboardStatutoryEvent, type DashboardStatutoryEvent } from './factories/dashboard.ts';
import {
    allMailComponents, type AntennaCriterion, type MailComponent, type NetcomAssignment, type NetworkRecentEvent,
    type NetworkRecentStatutoryEvent, type NetworkRecentSummerUniversity, type RecentBoardElection
} from './factories/network.ts';

// Every permission of the page: the criteria list, the NetCom assignment, the fulfilment mail
// and each criterion. Nobody holds all of them in production (the Network Director lacks the
// criteria list, the Network Commission the mail); the specs that are about a missing one take
// it out.
export const NETWORK_PERMISSIONS = [
    'antenna_criteria', 'netcom_assignment', 'fulfilment_email', 'communication', 'communication_exception', 'board_election',
    'members_list', 'membership_fee', 'events', 'agora_attendance', 'development_plan', 'fulfilment_report'
].map((name) => `global:manage_network:${name}`);

export const networkManager = (without: string[] = []): Permission[] => [
    ...seedPermissions('membersCircle'),
    ...NETWORK_PERMISSIONS.filter((name) => !without.includes(name)).map(permission)
];

// A body's members list for an Agora (`GET statutory /events/:id/memberslists`), as the
// statutory model sends it. Not a factory with a contract check: statutory converts the fees
// with an outside service when a list is uploaded, which the real stack can't reach.
export interface NetworkMemberslist {
    id: number;
    event_id: number;
    user_id: number;
    body_id: number;
    currency: string;
    conversion_rate: string;
    members: { user_id: number | null; first_name: string; last_name: string; fee: number; fee_to_aegee: number }[];
    fee_to_aegee: number;
    fee_paid: string;
    // What the body still owes AEGEE, in euro.
    fee_not_paid: number;
    created_at: string;
    updated_at: string;
}

export const memberslist = (overrides: Partial<NetworkMemberslist> = {}): NetworkMemberslist => ({
    id: id(),
    event_id: 1,
    user_id: 2,
    body_id: 1,
    currency: 'EUR',
    conversion_rate: '1',
    members: [{ user_id: 2, first_name: 'Alex', last_name: 'Member', fee: 10, fee_to_aegee: 1.5 }],
    fee_to_aegee: 1.5,
    fee_paid: '1.5',
    fee_not_paid: 0,
    created_at: iso(-40),
    updated_at: iso(-40),
    ...overrides
});

// The Agorae, the most recent first, as statutory lists them.
export const SPRING_AGORA = dashboardStatutoryEvent({ id: 7, name: 'Agora Spring 2027', type: 'agora', starts: '2027-04-20T08:00:00.000Z', ends: '2027-04-25T16:00:00.000Z' });
export const AUTUMN_AGORA = dashboardStatutoryEvent({ id: 6, name: 'Agora Autumn 2026', type: 'agora', starts: '2026-10-20T08:00:00.000Z', ends: '2026-10-25T16:00:00.000Z' });

export const NETWORK_COMMISSION = body({ id: 90, name: 'Network Commission', code: 'NWC', type: 'commission' });

// A member of the Network Commission body, with the first name the page shows and the address
// it sends the mail from (the Workspace address where there is one).
export const netcommie = (userId: number, firstName: string, { gsuite = null as string | null, email = `${firstName.toLowerCase()}@example.com` } = {}): BodyMembership => {
    const membership = bodyMembership({ body_id: NETWORK_COMMISSION.id, user_id: userId });
    membership.user.first_name = firstName;
    membership.user.gsuite_id = gsuite;
    membership.user.email = email;
    return membership;
};

export interface AcCheckData {
    agorae: DashboardStatutoryEvent[];
    // Every body core lists; the page keeps antennae, contact antennae and contacts.
    bodies: Body[];
    // What core finds for "network commission"; empty for none.
    netcomBodies: Body[];
    // The members of that body; null: not asked for (no such body, or no NetCom assignment).
    netcommies: BodyMembership[] | null;
    assignments: NetcomAssignment[];
    elections: RecentBoardElection[];
    memberslists: NetworkMemberslist[];
    events: NetworkRecentEvent[];
    statutoryEvents: NetworkRecentStatutoryEvent[];
    summerUniversities: NetworkRecentSummerUniversity[];
    criteria: AntennaCriterion[];
    // Asked for only with global:manage_network:fulfilment_email; null: not answered.
    mailComponents: MailComponent[] | null;
    // Answers that replace the ones above, for one route: an error, or a held answer.
    override: Record<string, Responder>;
}

// Answers every request of the page for the data of one check. The answers that depend on
// the Agora (`agora_id`, `ends`) are the same for every Agora unless a spec answers them itself.
export const mockAcCheck = (api: ApiMock, data: Partial<AcCheckData> = {}): AcCheckData => {
    const full: AcCheckData = {
        agorae: [SPRING_AGORA, AUTUMN_AGORA],
        bodies: [],
        netcomBodies: [NETWORK_COMMISSION],
        netcommies: [],
        assignments: [],
        elections: [],
        memberslists: [],
        events: [],
        statutoryEvents: [],
        summerUniversities: [],
        criteria: [],
        mailComponents: allMailComponents(SPRING_AGORA.id),
        override: {},
        ...data
    };
    api.json('GET statutory /', ok(full.agorae));
    api.on('GET core /bodies', ({ query }) => ({ json: ok(query.get('query') === 'network commission' ? full.netcomBodies : full.bodies) }));
    if (full.netcommies) api.json('GET core /bodies/:id/members', ok(full.netcommies));
    api.json('GET network /netcom', ok(full.assignments));
    api.json('GET network /boards/recents', ok(full.elections));
    api.json('GET statutory /events/:id/memberslists', ok(full.memberslists));
    api.json('GET events /recents', ok(full.events));
    api.json('GET statutory /recents', ok(full.statutoryEvents));
    api.json('GET summeruniversity /recents', ok(full.summerUniversities));
    api.json('GET network /antennaCriteria/:agora_id', ok(full.criteria));
    if (full.mailComponents) api.json('GET network /mailComponent/:agora_id', ok(full.mailComponents));
    for (const [route, answer] of Object.entries(full.override)) api.on(route, answer);
    return full;
};

export const acCheck = (page: Page): Locator => page.getByRole('article', { name: 'Antenna Criteria Check' });
export const acTable = (page: Page): Locator => acCheck(page).getByRole('table');
