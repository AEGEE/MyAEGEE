// Checks the builders the mocked-API suite uses for the events service
// (ui/support/factories/events.ts) against what events really answers. See
// tests/core-contract.spec.ts for how the comparison works.
import type { Envelope } from '../support/api.ts';
import { test, expect, expectStatus } from '../support/api.ts';
import { expectShape } from '../support/contract.ts';
import { uploadPicture } from '../support/core-data.ts';
import { notFound, validationError } from '../ui/support/factories/base.ts';
import {
    application, boardviewApplication, event, eventPermissions, eventSummary, organizedEvent, organizer, organizerPermissions, participantRow, participatingEvent, question
} from '../ui/support/factories/events.ts';

type Single = Envelope<{ questions: unknown[] }> & { permissions: unknown };

test.describe('events factories match the real API', () => {
    test('lists, a single event, its permissions and an application', async ({ api }) => {
        const created = await api.createEvent('admin', {
            type: 'training',
            questions: [{ type: 'select', description: 'Size', required: true, values: ['S', 'M'] }],
            locations: [{ name: 'Brussels', position: { lat: 50.85, lng: 4.35 } }],
            optional_programme: 'A city tour on the day after',
            link_info_travel_country: 'https://www.example.org/travel'
        });
        await uploadPicture(api, 'admin', `/api/events/single/${created.id}/upload`);
        await api.publishAsAdmin(created.id);

        // Every optional field filled on both sides, as null and empty lists aren't compared.
        const filled = {
            image: 'picture.png',
            locations: [{ name: 'x', position: { lat: 1, lng: 1 } }],
            optional_programme: 'x',
            link_info_travel_country: 'x'
        };

        const list = await api.call<Envelope<unknown[]>>('member', 'GET', '/api/events/?limit=200');
        const listed = list.body.data.find((item) => (item as { id: number }).id === created.id);
        expect(listed, 'the new event is listed').toBeTruthy();
        expectShape('eventSummary', eventSummary(filled), listed);

        const single = await api.call<Single>('member', 'GET', `/api/events/single/${created.url}`);
        expectStatus(single, 200);
        // Members don't get the organisers' fields (budget, programme, organizers): optional in the factory.
        expectShape('event', event({ ...filled, questions: [question({ type: 'select' })] }), single.body.data);
        expectShape('question', question({ type: 'select' }), single.body.data.questions[0]);
        // The keys of these two are the ids of the user's bodies.
        const perBody = {
            ignore: {
                '$.set_board_comment': 'its keys are the ids of the bodies of whoever asks',
                '$.see_boardview': 'its keys are the ids of the bodies of whoever asks'
            }
        };
        expectShape('eventPermissions', eventPermissions(), single.body.permissions, perBody);

        const asOrganizer = await api.call<Single>('admin', 'GET', `/api/events/single/${created.url}`);
        expectStatus(asOrganizer, 200);
        expectShape('organizerPermissions', organizerPermissions(), asOrganizer.body.permissions, perBody);
        expectShape('event', event({
            ...filled, questions: [question({ type: 'select' })], budget: 'x', programme: 'x', organizers: [{ user_id: 1, first_name: 'x', last_name: 'x' }]
        }), asOrganizer.body.data);

        const applicant = await api.me('member');
        const applied = await api.call<Envelope<{ id: number }>>('member', 'POST', `/api/events/single/${created.id}/applications`, {
            body_id: applicant.bodies[0].id, answers: ['S'], agreed_to_privacy_policy: true
        });
        expectStatus(applied, 200);
        // The board of the applicant's body leaves a comment, so that field has a value.
        expectStatus(await api.call('board', 'PUT', `/api/events/single/${created.id}/applications/${applied.body.data.id}/comment`, { board_comment: 'Active member' }), 200);

        const noEmail = { gaps: { '$.email': 'events keeps the column but nothing fills it: every application made today has null' } };
        // The applicant doesn't get the board's comment on their application; the organiser does.
        const mine = await api.call<Envelope<Record<string, unknown>>>('member', 'GET', `/api/events/single/${created.id}/applications/me`);
        expectStatus(mine, 200);
        expect(mine.body.data).not.toHaveProperty('board_comment');
        expectShape('application', application({ answers: ['S'], board_comment: undefined }), mine.body.data, noEmail);

        const organizersView = await api.call<Envelope<unknown>>('admin', 'GET', `/api/events/single/${created.id}/applications/${applied.body.data.id}`);
        expectStatus(organizersView, 200);
        expectShape('application', application({ answers: ['S'], board_comment: 'x' }), organizersView.body.data, noEmail);
    });

    test('the organisers\' and boards\' lists, and what a member takes part in', async ({ api }) => {
        const applicant = await api.me('member');
        const created = await api.createEvent('admin', {
            questions: [{ type: 'string', description: 'Why?', required: true }],
            locations: [{ name: 'Brussels', position: { lat: 50.85, lng: 4.35 } }],
            optional_programme: 'A city tour on the day after',
            link_info_travel_country: 'https://www.example.org/travel',
            organizers: [{ user_id: (await api.me('admin')).id, comment: 'Main organiser' }]
        });
        await uploadPicture(api, 'admin', `/api/events/single/${created.id}/upload`);

        // Not published yet: the approvers' list has it, with every field.
        const approvable = await api.call<Envelope<{ id: number }[]>>('admin', 'GET', '/api/events/mine/approvable');
        expectStatus(approvable, 200);
        const filled = {
            image: 'picture.png',
            locations: [{ name: 'x', position: { lat: 1, lng: 1 } }],
            optional_programme: 'x',
            link_info_travel_country: 'x',
            questions: [question({ type: 'string' })],
            organizers: [organizer()]
        };
        expectShape('organizedEvent', organizedEvent({ ...filled, status: 'draft', publication_date: undefined }), approvable.body.data.find((item) => item.id === created.id));
        await api.publishAsAdmin(created.id);

        const asOrganizer = await api.call<Envelope<{ organizers: unknown[] }>>('admin', 'GET', `/api/events/single/${created.id}`);
        expectStatus(asOrganizer, 200);
        expectShape('organizedEvent', organizedEvent(filled), asOrganizer.body.data);
        expectShape('organizer', organizer(), asOrganizer.body.data.organizers[0]);

        const applied = await api.call<Envelope<{ id: number }>>('member', 'POST', `/api/events/single/${created.id}/applications`, {
            body_id: applicant.bodies[0].id, answers: ['Because'], agreed_to_privacy_policy: true
        });
        expectStatus(applied, 200);
        expectStatus(await api.call('board', 'PUT', `/api/events/single/${created.id}/applications/${applied.body.data.id}/comment`, { board_comment: 'Active member' }), 200);
        const noEmail = { gaps: { '$.email': 'events keeps the column but nothing fills it: every application made today has null' } };

        const participating = await api.call<Envelope<{ id: number }[]>>('member', 'GET', '/api/events/mine/participating?limit=200');
        expectStatus(participating, 200);
        expectShape('participatingEvent', participatingEvent({ image: 'x', locations: filled.locations, optional_programme: 'x', link_info_travel_country: 'x' }), participating.body.data.find((item) => item.id === created.id));

        const rows = await api.call<Envelope<unknown[]>>('admin', 'GET', `/api/events/single/${created.id}/applications`);
        expectStatus(rows, 200);
        expectShape('participantRow', participantRow({ answers: ['x'], board_comment: 'x' }), rows.body.data[0], noEmail);

        const boardview = await api.call<Envelope<{ event_id: number }[]>>('board', 'GET', `/api/events/boardview/${applicant.bodies[0].id}`);
        expectStatus(boardview, 200);
        expectShape(
            'boardviewApplication',
            boardviewApplication({ answers: ['x'], board_comment: 'x' }, { image: 'x', locations: filled.locations, optional_programme: 'x', link_info_travel_country: 'x' }),
            boardview.body.data.find((item) => item.event_id === created.id),
            noEmail
        );
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
