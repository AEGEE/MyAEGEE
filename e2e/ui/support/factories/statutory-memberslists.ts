// Factories for the members lists of an Agora (the members of a local and the fees they paid,
// which the fee to AEGEE-Europe and the votes follow from), the bodies statutory lists as
// missing a members list or without a fee, and the votes per antenna and per delegate. See
// base.ts for the rules, and statutory-events.ts for how the statutory factories are split.
//
// The members a members list is made from come from core: build them with `bodyMembership()`
// and `payment()` of core.ts.
import { id, iso } from './base.ts';
import type { Body } from './core.ts';

// What statutory charges a local per member of its members list, in euro
// (helpers.calculateFeeForMember): 12.5% of the fee up to 30 euro, 5% of the part above, and
// never less than 2 euro. `conversionRate` is how many of the list's currency make one euro.
export const feeToAegee = (fee: number, conversionRate = 1): number => {
    const feeInEuro = fee / conversionRate;
    const share = feeInEuro <= 30 ? feeInEuro * 0.125 : (30 * 0.125) + (feeInEuro - 30) * 0.05;
    return Math.max(share, 2);
};

// Rounds to cents, without a negative zero (helpers.normalizeMoney).
const normalizeMoney = (value: number): number => {
    const rounded = Math.round(value * 100) / 100;
    return Object.is(rounded, -0) ? 0 : rounded;
};

// One member of a members list as statutory answers it: what the local sent, and the fee to
// AEGEE-Europe statutory computed for them. `user_id` is null for the lists of old that were
// uploaded from a file.
export interface MembersListMember {
    user_id: number | null;
    first_name: string;
    last_name: string;
    // The fee the member paid to the local, in the list's currency.
    fee: number;
    fee_to_aegee: number;
}

export const membersListMember = (overrides: Partial<MembersListMember> = {}, conversionRate = 1): MembersListMember => {
    const fee = overrides.fee ?? 40;
    return {
        user_id: id(),
        first_name: 'Alex',
        last_name: 'Member',
        fee,
        fee_to_aegee: feeToAegee(fee, conversionRate),
        ...overrides
    };
};

// The members list of a body for an event (models/MembersList.js), as GET
// /events/:id/memberslists lists it, GET and POST /events/:id/memberslists/:body_id answer it.
// The sums follow from the members and `fee_paid` unless overridden.
export interface MembersList {
    id: number;
    event_id: number;
    // Who uploaded it.
    user_id: number;
    body_id: number;
    // A key of the frontend's currencies.json: `EU` is the euro.
    currency: string;
    conversion_rate: number;
    members: MembersListMember[];
    fee_to_aegee: number;
    fee_paid: number;
    fee_not_paid: number;
    created_at: string;
    updated_at: string;
}

// Two members of body 1 who paid 40 and 20 euro: 4.25 + 2.50 = 6.75 euro to AEGEE-Europe,
// nothing of it paid yet.
export const membersList = (overrides: Partial<MembersList> = {}): MembersList => {
    const conversionRate = overrides.conversion_rate ?? 1;
    const members = overrides.members ?? [
        membersListMember({ user_id: 2, first_name: 'Alex', last_name: 'Member', fee: 40 }, conversionRate),
        membersListMember({ user_id: 3, first_name: 'Bea', last_name: 'Board', fee: 20 }, conversionRate)
    ];
    const feeToAegeeTotal = overrides.fee_to_aegee ?? members.reduce((sum, member) => sum + member.fee_to_aegee, 0);
    const feePaid = overrides.fee_paid ?? 0;
    return {
        id: id(),
        event_id: 1,
        user_id: 3,
        body_id: 1,
        currency: 'EU',
        conversion_rate: conversionRate,
        members,
        fee_to_aegee: feeToAegeeTotal,
        fee_paid: feePaid,
        fee_not_paid: normalizeMoney(feeToAegeeTotal - feePaid),
        created_at: iso(-3),
        updated_at: iso(-2),
        ...overrides
    };
};

// A local as GET /events/:id/memberslists/missing and /memberslists/without_fee list it: the
// bodies without a members list, or whose list has no member with a fee. Statutory sends only
// these three fields of core's body.
export type MembersListBody = Pick<Body, 'id' | 'name' | 'type'>;

export const membersListBody = (overrides: Partial<MembersListBody> = {}): MembersListBody => {
    const bodyId = overrides.id ?? id();
    return {
        id: bodyId,
        name: `AEGEE-Test ${bodyId}`,
        type: 'antenna',
        ...overrides
    };
};

// The votes of an antenna at an Agora (models/VotesPerAntenna.js), as GET
// /events/:id/votes-amounts/antenna lists them. Statutory computes them from the number of
// members on its members list (one vote for up to 20 members).
export interface VotesPerAntenna {
    id: number;
    event_id: number;
    body_id: number;
    votes: number;
    created_at: string;
    updated_at: string;
}

export const votesPerAntenna = (overrides: Partial<VotesPerAntenna> = {}): VotesPerAntenna => ({
    id: id(),
    event_id: 1,
    body_id: 1,
    votes: 1,
    created_at: iso(-2),
    updated_at: iso(-2),
    ...overrides
});

// The votes of a delegate (models/VotesPerDelegate.js), as GET
// /events/:id/votes-amounts/delegate lists them: `off-event` among the confirmed delegates of
// the antenna, `on-event` among those who are at the Agora. Every member may see them, so of
// the application statutory sends only what identifies it (ALLOWED_VOTES_APPLICATION_FIELDS).
export interface VotesPerDelegate {
    id: number;
    event_id: number;
    application_id: number;
    body_id: number;
    user_id: number;
    type: 'off-event' | 'on-event';
    votes: number;
    created_at: string;
    updated_at: string;
    application: { statutory_id: string; user_id: number; body_id: number };
}

export const votesPerDelegate = (overrides: Partial<VotesPerDelegate> = {}): VotesPerDelegate => {
    const userId = overrides.user_id ?? 2;
    const bodyId = overrides.body_id ?? 1;
    return {
        id: id(),
        event_id: 1,
        application_id: 12,
        body_id: bodyId,
        user_id: userId,
        type: 'off-event',
        votes: 1,
        created_at: iso(-2),
        updated_at: iso(-2),
        application: { statutory_id: '001-0001', user_id: userId, body_id: bodyId },
        ...overrides
    };
};

// Builders that make no entity of their own (see scripts/check-factory-contracts.ts).
export const NOT_ENTITIES = ['feeToAegee'];
