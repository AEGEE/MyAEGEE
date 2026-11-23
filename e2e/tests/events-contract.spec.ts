// Checks the builders the mocked-API suite uses for the events service
// (ui/support/factories/events.ts) against what events really answers. See
// tests/core-contract.spec.ts for how the comparison works.
import type { Envelope } from '../support/api.ts';
import { test, expect, expectStatus } from '../support/api.ts';
import { expectShape } from '../support/contract.ts';
import { notFound, validationError } from '../ui/support/factories/base.ts';
import { application, event, eventPermissions, eventSummary, organizerPermissions, question } from '../ui/support/factories/events.ts';

type Single = Envelope<{ questions: unknown[] }> & { permissions: unknown };

test.describe('events factories match the real API', () => {
    test('lists, a single event, its permissions and an application', async ({ api }) => {
        const created = await api.createEvent('admin', {
            type: 'training',
            questions: [{ type: 'select', description: 'Size', required: true, values: ['S', 'M'] }],
            locations: [{ name: 'Brussels', position: { lat: 50.85, lng: 4.35 } }]
        });
        await api.publishAsAdmin(created.id);

        const list = await api.call<Envelope<unknown[]>>('member', 'GET', '/api/events/?limit=200');
        const listed = list.body.data.find((item) => (item as { id: number }).id === created.id);
        expect(listed, 'the new event is listed').toBeTruthy();
        expectShape('eventSummary', eventSummary({ locations: [{ name: 'x', position: { lat: 1, lng: 1 } }] }), listed);

        const single = await api.call<Single>('member', 'GET', `/api/events/single/${created.url}`);
        expectStatus(single, 200);
        // Members don't get the organisers' fields (budget, programme, organizers): optional in the factory.
        expectShape('event', event({ questions: [question({ type: 'select' })] }), single.body.data);
        expectShape('question', question({ type: 'select' }), single.body.data.questions[0]);
        // The keys of these two are the ids of the user's bodies.
        const perBody = { ignore: ['$.set_board_comment', '$.see_boardview'] };
        expectShape('eventPermissions', eventPermissions(), single.body.permissions, perBody);

        const asOrganizer = await api.call<Single>('admin', 'GET', `/api/events/single/${created.url}`);
        expectStatus(asOrganizer, 200);
        expectShape('organizerPermissions', organizerPermissions(), asOrganizer.body.permissions, perBody);
        expectShape('event', event({ budget: 'x', programme: 'x', organizers: [{ user_id: 1, first_name: 'x', last_name: 'x' }] }), asOrganizer.body.data);

        const applicant = await api.me('member');
        const applied = await api.call<Envelope<unknown>>('member', 'POST', `/api/events/single/${created.id}/applications`, {
            body_id: applicant.bodies[0].id, answers: ['S'], agreed_to_privacy_policy: true
        });
        expectStatus(applied, 200);
        const mine = await api.call<Envelope<unknown>>('member', 'GET', `/api/events/single/${created.id}/applications/me`);
        expectShape('application', application({ answers: ['S'] }), mine.body.data);
    });

    test('validation errors and unknown items', async ({ api }) => {
        const created = await api.createEvent('admin', { questions: [{ type: 'string', description: 'Why?', required: true }] });
        await api.publishAsAdmin(created.id);
        const applicant = await api.me('member');

        const invalid = await api.call('member', 'POST', `/api/events/single/${created.id}/applications`, { body_id: applicant.bodies[0].id, answers: [''], agreed_to_privacy_policy: false });
        expectStatus(invalid, 422);
        expectShape('validationError', validationError({ answers: ['x'], agreed_to_privacy_policy: ['x'] }), invalid.body);

        const missing = await api.call('member', 'GET', `/api/events/single/${created.id}/applications/me`);
        expectStatus(missing, 404);
        expectShape('notFound', notFound('x'), missing.body);
    });
});
