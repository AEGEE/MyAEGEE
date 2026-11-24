// Test data for the flows through the members lists of an Agora, made through the APIs like the
// helpers of core-data.ts. Saving a members list asks the currency conversion rates of
// support/fake-currency.ts, through statutory's CONVERSION_RATE_API_HOST. A members list goes
// with its event; nothing here needs a cleanup.
import type { Api, Envelope, StatutoryEvent } from './api.ts';
import { expectStatus } from './api.ts';
import type { Username } from './constants.ts';

export interface SavedMembersListMember {
    user_id: number | null;
    first_name: string;
    last_name: string;
    fee: number;
}

// Saves the members list of `bodyId` for the event as `username` (admin may do it for any
// body) and returns what statutory answered.
export async function saveMembersList(api: Api, event: StatutoryEvent, bodyId: number, members: SavedMembersListMember[], { currency = 'EU', username = 'admin' }: { currency?: string; username?: Username } = {}): Promise<Record<string, unknown>> {
    const res = await api.call<Envelope<Record<string, unknown>>>(username, 'POST', `/api/statutory/events/${event.id}/memberslists/${bodyId}`, { currency, members });
    expectStatus(res, 200);
    return res.body.data;
}
