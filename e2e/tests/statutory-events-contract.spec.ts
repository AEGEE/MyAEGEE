// Checks the builders the mocked-API suite uses for statutory events
// (ui/support/factories/statutory-events.ts) against what statutory really answers. See
// tests/core-contract.spec.ts for how the comparison works.
import type { Envelope } from '../support/api.ts';
import { test, expect, expectStatus } from '../support/api.ts';
import { expectShape } from '../support/contract.ts';
import { ONE_PIXEL_PNG } from '../support/core-data.ts';
import { notFound } from '../ui/support/factories/base.ts';
import {
    allStatutoryPermissions,
    defaultPaxLimit,
    massmailerResult,
    paxLimit,
    statusChangeResult,
    statutoryEvent,
    statutoryEventPermissions,
    statutoryEventSummary,
    statutoryImage,
    statutoryManagerPermissions,
    statutoryOrganiserPermissions,
    statutoryTask
} from '../ui/support/factories/statutory-events.ts';

// The keys of the per-body permissions are the ids of the viewer's bodies.
const perBody = {
    ignore: {
        '$.permissions.set_board_comment_and_participant_type': 'its keys are the ids of the bodies of whoever asks',
        '$.permissions.see_boardview': 'its keys are the ids of the bodies of whoever asks',
        '$.permissions.upload_memberslist': 'its keys are the ids of the bodies of whoever asks',
        '$.permissions.edit_memberslist': 'its keys are the ids of the bodies of whoever asks',
        '$.permissions.see_memberslist': 'its keys are the ids of the bodies of whoever asks',
        '$.permissions.apply_from_body': 'its keys are the ids of the bodies of whoever asks'
    }
};
const perBodyAtTop = { ignore: Object.fromEntries(Object.entries(perBody.ignore).map(([path, reason]) => [path.replace('.permissions', ''), reason])) };

test.describe('statutory event factories match the real API', () => {
    test('the list, a single event, its picture and the permissions', async ({ api }) => {
        const created = await api.createStatutoryEvent({
            locations: [{ name: 'Brussels', position: { lat: 50.85, lng: 4.35 } }],
            booklet_folder: 'https://wiki.example.org/agora'
        });
        const { access } = await api.login('admin');
        const upload = await api.request.post(`/api/statutory/events/${created.id}/image`, {
            headers: { 'X-Requested-With': 'XMLHttpRequest', 'X-Auth-Token': access },
            multipart: { image: { name: 'picture.png', mimeType: 'image/png', buffer: ONE_PIXEL_PNG } }
        });
        expect(upload.status(), await upload.text()).toBe(200);
        const published = await api.call('admin', 'PUT', `/api/statutory/events/${created.id}/status`, { status: 'published' });
        expectStatus(published, 200);
        expectShape('statusChangeResult', statusChangeResult(), published.body);

        // Optional fields filled on both sides, as null and empty lists aren't compared.
        const filled = {
            image_id: 3,
            image: statutoryImage(),
            locations: [{ name: 'x', position: { lat: 1, lng: 1 } }],
            previous_agora_id: null
        };

        const list = await api.call<Envelope<{ id: number; image: unknown }[]>>('member', 'GET', '/api/statutory/');
        expectStatus(list, 200);
        const listed = list.body.data.find((item) => item.id === created.id);
        expect(listed, 'the new event is listed').toBeTruthy();
        expectShape('statutoryEventSummary', statutoryEventSummary(filled), listed, {
            gaps: {
                '$.previous_agora_id': 'only an Agora created after another one has it, and the tests create none in order',
                '$.application_status_revealed_at': 'set only when the participants list was published before the event was created'
            }
        });
        expectShape('statutoryImage', statutoryImage(), listed!.image);

        const single = await api.call<Envelope<unknown>>('member', 'GET', `/api/statutory/events/${created.url}`);
        expectStatus(single, 200);
        expectShape('statutoryEvent', statutoryEvent(filled), single.body.data, {
            ...perBody,
            gaps: {
                '$.previous_agora_id': 'only an Agora created after another one has it, and the tests create none in order',
                '$.application_status_revealed_at': 'set only when the participants list was published before the event was created'
            }
        });
        const memberPermissions = (single.body.data as { permissions: unknown }).permissions;
        expectShape('statutoryEventPermissions', statutoryEventPermissions(), memberPermissions, perBodyAtTop);

        const asAdmin = await api.call<Envelope<{ permissions: unknown }>>('admin', 'GET', `/api/statutory/events/${created.url}`);
        expectStatus(asAdmin, 200);
        expectShape('allStatutoryPermissions', allStatutoryPermissions(), asAdmin.body.data.permissions, perBodyAtTop);
        expectShape('statutoryOrganiserPermissions', statutoryOrganiserPermissions(), asAdmin.body.data.permissions, perBodyAtTop);
        expectShape('statutoryManagerPermissions', statutoryManagerPermissions(), asAdmin.body.data.permissions, perBodyAtTop);
    });

    test('the participants limits of a body, its own and the default one', async ({ api, otherAntenna }) => {
        const listed = await api.call<Envelope<{ body_id: number }[]>>('admin', 'GET', '/api/statutory/limits/agora');
        expectStatus(listed, 200);
        const generated = listed.body.data.find((limit) => limit.body_id === otherAntenna.body.id);
        expect(generated, 'the new antenna has a default limit').toBeTruthy();
        const nullable = { gaps: { '$.id': 'a default limit is not stored, so it never has an id' } };
        expectShape('defaultPaxLimit', defaultPaxLimit(), generated, nullable);

        const defaults = await api.call<Envelope<{ body_id: number }[]>>('admin', 'GET', '/api/statutory/limits/agora/defaults');
        expectStatus(defaults, 200);
        expectShape('defaultPaxLimit', defaultPaxLimit(), defaults.body.data.find((limit) => limit.body_id === otherAntenna.body.id), nullable);

        const saved = await api.call<Envelope<unknown>>('admin', 'POST', '/api/statutory/limits/agora', { body_id: otherAntenna.body.id, delegate: 2, envoy: 1, observer: 1, visitor: 10 });
        try {
            expectStatus(saved, 200);
            expectShape('paxLimit', paxLimit(), saved.body.data);
            const own = await api.call<Envelope<{ body_id: number }[]>>('admin', 'GET', '/api/statutory/limits/agora');
            expectShape('paxLimit', paxLimit(), own.body.data.find((limit) => limit.body_id === otherAntenna.body.id));
        } finally {
            expectStatus(await api.call('admin', 'DELETE', `/api/statutory/limits/agora/${otherAntenna.body.id}`), 200);
        }
    });

    test('a background task and a mass mail', async ({ api }) => {
        const event = await api.createStatutoryEvent();
        // A position whose applications open tomorrow: the service schedules opening them.
        const now = Date.now();
        const position = await api.call<Envelope<{ id: number }>>('admin', 'POST', `/api/statutory/events/${event.id}/positions`, {
            name: 'Contract position',
            places: 1,
            starts: new Date(now + 24 * 60 * 60 * 1000),
            ends: new Date(now + 5 * 24 * 60 * 60 * 1000),
            start_term: '2030-01-01',
            end_term: '2030-12-31',
            requirements: 'None'
        });
        expectStatus(position, 200);

        const tasks = await api.call<Envelope<Record<string, { params: { id: number } }>>>('admin', 'GET', '/api/statutory/tasks');
        expectStatus(tasks, 200);
        const task = Object.values(tasks.body.data).find((item) => item.params.id === position.body.data.id);
        expect(task, 'the opening of the position is scheduled').toBeTruthy();
        expectShape('statutoryTask', statutoryTask(), task);

        await api.applyToStatutory('member', event);
        const mail = await api.call('admin', 'POST', `/api/statutory/events/${event.id}/massmailer`, {
            subject: 'Contract check',
            text: '<p>Hello {first_name}</p>',
            reply_to: 'board@example.org',
            filter: {}
        });
        expectStatus(mail, 200);
        expectShape('massmailerResult', massmailerResult(), mail.body);
    });

    test('an unknown event', async ({ api }) => {
        const missing = await api.call('member', 'GET', '/api/statutory/events/no-such-event-anywhere');
        expectStatus(missing, 404);
        expectShape('notFound', notFound('x'), missing.body);
    });
});
