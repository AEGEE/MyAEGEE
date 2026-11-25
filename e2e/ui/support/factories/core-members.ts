// Factories for what the member pages of core get (views/core/members/). See base.ts for the
// rules; the member itself is `member()` in core.ts.
import { iso, id } from './base.ts';
import { member, type MembershipUser } from './core.ts';

// A row of `GET core /members` and `GET core /members/unconfirmed`: the user's own fields,
// without bodies, circles or the event application ban. Wrap a page of them in
// `okList(rows, count)`.
export interface MemberListItem extends MembershipUser {
    // The id only: the list has no body objects.
    primary_body_id: number | null;
}

// What `GET core /members/:id` adds to the user's own fields; a row of the lists has none of it.
const RELATIONS = ['primary_body', 'bodies', 'circles', 'join_requests', 'event_application_ban'];

export const memberListItem = (overrides: Partial<MemberListItem> = {}): MemberListItem => {
    const full = member({ ...(overrides.id === undefined ? {} : { id: overrides.id }), bodies: [] });
    const own = Object.fromEntries(Object.entries(full).filter(([key]) => !RELATIONS.includes(key))) as Omit<MemberListItem, 'gsuite_id' | 'campaign_id' | 'last_logged_in' | 'last_active'>;
    return {
        ...own,
        primary_body_id: 1,
        gsuite_id: null,
        campaign_id: null,
        last_logged_in: iso(-2),
        last_active: iso(-1),
        ...overrides
    };
};

// What `PUT core /members/:id/event-application-ban` answers: the ban that is now active.
// (`GET core /members/:id` has the same row in `event_application_ban`.)
export interface EventApplicationBanRow {
    id: number;
    user_id: number;
    banned_by_user_id: number;
    ban_until: string;
    lifted_by_user_id: number | null;
    lifted_at: string | null;
    created_at: string;
    updated_at: string;
}

export const eventApplicationBan = (overrides: Partial<EventApplicationBanRow> = {}): EventApplicationBanRow => ({
    id: id(),
    user_id: 2,
    banned_by_user_id: 1,
    ban_until: iso(30),
    lifted_by_user_id: null,
    lifted_at: null,
    created_at: iso(0),
    updated_at: iso(0),
    ...overrides
});

// A future application of a member, as `GET <service> /applications/future/:user_id` lists
// them: the member page asks events, statutory and summeruniversity before it bans a member
// from applying. The three services answer the same shape and only differ in `service`. It is
// here and not in events.ts because only this page asks for it, from all three services.
export interface FutureApplication {
    service: 'events' | 'statutory' | 'summeruniversity';
    application_id: number;
    application_status: string;
    event_id: number;
    event_name: string;
    event_type: string;
    event_starts: string;
}

export const futureApplication = (overrides: Partial<FutureApplication> = {}): FutureApplication => {
    const eventId = overrides.event_id ?? id();
    return {
        service: 'events',
        application_id: id(),
        application_status: 'pending',
        event_id: eventId,
        event_name: `Training Course ${eventId}`,
        event_type: 'training',
        event_starts: iso(20),
        ...overrides
    };
};
