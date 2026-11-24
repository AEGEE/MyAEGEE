// Checks the builders the mocked-API suite uses for the members lists and votes of an Agora
// (ui/support/factories/statutory-memberslists.ts) against what statutory really answers. See
// tests/core-contract.spec.ts for how the comparison works.
//
// Saving a members list asks the currency conversion rates from a host that statutory only
// takes from its configuration (CONVERSION_RATE_API_HOST) since statutory PR #2405: the second
// test can only pass once that is merged.
import type { Envelope } from '../support/api.ts';
import { test, expectStatus } from '../support/api.ts';
import { expectShape } from '../support/contract.ts';
import { acceptedDelegate } from '../support/statutory-plenaries-data.ts';
import { saveMembersList } from '../support/statutory-memberslists-data.ts';
import { membersList, membersListBody, membersListMember, votesPerAntenna, votesPerDelegate } from '../ui/support/factories/statutory-memberslists.ts';

test.describe('statutory members list and votes factories match the real API', () => {
    test('a local without a members list', async ({ api, otherAntenna }) => {
        const event = await api.createStatutoryEvent();

        const missing = await api.call<Envelope<{ id: number }[]>>('admin', 'GET', `/api/statutory/events/${event.id}/memberslists/missing`);
        expectStatus(missing, 200);
        const row = missing.body.data.find((item) => item.id === otherAntenna.body.id);
        expectShape('membersListBody', membersListBody(), row);
    });

    test('a saved members list and the votes it gives', async ({ api, otherAntenna }) => {
        const event = await api.createStatutoryEvent();
        expectStatus(await api.call('admin', 'PUT', `/api/statutory/events/${event.id}/status`, { status: 'published' }), 200);
        // A confirmed delegate of the antenna, who gets its votes.
        const delegate = await acceptedDelegate(api, event, otherAntenna.member.username);
        expectStatus(await api.call('admin', 'PUT', `/api/statutory/events/${event.id}/applications/${delegate.id}/confirmed`, { confirmed: true }), 200);
        await saveMembersList(api, event, otherAntenna.body.id, [
            { user_id: otherAntenna.member.id, first_name: otherAntenna.member.first_name, last_name: otherAntenna.member.last_name, fee: 40 }
        ]);

        const list = await api.call<Envelope<{ body_id: number; members: unknown[] }[]>>('admin', 'GET', `/api/statutory/events/${event.id}/memberslists`);
        expectStatus(list, 200);
        const saved = list.body.data.find((item) => item.body_id === otherAntenna.body.id);
        expectShape('membersList', membersList(), saved);
        expectShape('membersListMember', membersListMember(), saved?.members[0]);

        const antennae = await api.call<Envelope<{ body_id: number }[]>>('member', 'GET', `/api/statutory/events/${event.id}/votes-amounts/antenna`);
        expectStatus(antennae, 200);
        expectShape('votesPerAntenna', votesPerAntenna(), antennae.body.data.find((item) => item.body_id === otherAntenna.body.id));

        const delegates = await api.call<Envelope<{ body_id: number }[]>>('member', 'GET', `/api/statutory/events/${event.id}/votes-amounts/delegate`);
        expectStatus(delegates, 200);
        expectShape('votesPerDelegate', votesPerDelegate(), delegates.body.data.find((item) => item.body_id === otherAntenna.body.id));
    });
});
