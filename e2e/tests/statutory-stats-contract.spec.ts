// Checks the builders the mocked-API suite uses for the application statistics and the
// exportable fields of statutory events (ui/support/factories/statutory-stats.ts) against what
// statutory really answers. See tests/core-contract.spec.ts for how the comparison works.
import type { Envelope } from '../support/api.ts';
import { test, expectStatus } from '../support/api.ts';
import { expectShape } from '../support/contract.ts';
import { applicationFields, incomingApplicationFields, statutoryStats } from '../ui/support/factories/statutory-stats.ts';

test.describe('statutory statistics and field list factories match the real API', () => {
    test('the statistics of an event with an accepted delegate', async ({ api }) => {
        const event = await api.createStatutoryEvent();
        expectStatus(await api.call('admin', 'PUT', `/api/statutory/events/${event.id}/status`, { status: 'published' }), 200);
        const applied = await api.applyToStatutory('member', event);
        // A place and a status, so every breakdown has a value to compare.
        expectStatus(await api.call('admin', 'PUT', `/api/statutory/events/${event.id}/applications/${applied.id}/board`, {
            board_comment: 'Our delegate', participant_type: 'delegate', participant_order: 1
        }), 200);
        expectStatus(await api.call('admin', 'PUT', `/api/statutory/events/${event.id}/applications/${applied.id}/status`, { status: 'accepted' }), 200);

        const stats = await api.call<Envelope<unknown>>('admin', 'GET', `/api/statutory/events/${event.id}/applications/stats`);
        expectStatus(stats, 200);
        expectShape('statutoryStats', statutoryStats(), stats.body.data);
    });

    test('the fields an export offers', async ({ api }) => {
        const event = await api.createStatutoryEvent();

        const all = await api.call<Envelope<unknown>>('admin', 'GET', `/api/statutory/events/${event.id}/fields/applications/all`);
        expectStatus(all, 200);
        expectShape('applicationFields', applicationFields(event.questions), all.body.data);

        const incoming = await api.call<Envelope<unknown>>('admin', 'GET', `/api/statutory/events/${event.id}/fields/applications/incoming`);
        expectStatus(incoming, 200);
        expectShape('incomingApplicationFields', incomingApplicationFields(), incoming.body.data);
    });
});
