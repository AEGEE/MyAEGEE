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
    statutoryEvent,
    statutoryEventPermissions,
    statutoryEventSummary,
    statutoryImage,
    statutoryManagerPermissions,
    statutoryOrganiserPermissions
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
        expectStatus(await api.call('admin', 'PUT', `/api/statutory/events/${created.id}/status`, { status: 'published' }), 200);

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

    test('an unknown event', async ({ api }) => {
        const missing = await api.call('member', 'GET', '/api/statutory/events/no-such-event-anywhere');
        expectStatus(missing, 404);
        expectShape('notFound', notFound('x'), missing.body);
    });
});
