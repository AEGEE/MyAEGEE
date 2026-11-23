// Checks the builders the mocked-API suite uses for applications to statutory events
// (ui/support/factories/statutory-applications.ts) against what statutory really answers. See
// tests/core-contract.spec.ts for how the comparison works.
import type { Envelope } from '../support/api.ts';
import { test, expectStatus } from '../support/api.ts';
import { expectShape } from '../support/contract.ts';
import { body } from '../ui/support/factories/core.ts';
import {
    applicationPermissions,
    incomingApplication,
    listedApplication,
    paxLimit,
    singleStatutoryApplication,
    statutoryApplication
} from '../ui/support/factories/statutory-applications.ts';

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

// Nothing in the tests can fill these: the applicant applies without a visa, and the fields
// the board and the officers set have their own routes.
const unfilled = {
    '$.email': 'statutory keeps the column but nothing fills it: every application made today has null',
    '$.visa_place_of_birth': 'only filled when a visa is required, and the e2e applicant needs none',
    '$.visa_passport_number': 'only filled when a visa is required, and the e2e applicant needs none',
    '$.visa_passport_issue_date': 'only filled when a visa is required, and the e2e applicant needs none',
    '$.visa_passport_expiration_date': 'only filled when a visa is required, and the e2e applicant needs none',
    '$.visa_passport_issue_authority': 'only filled when a visa is required, and the e2e applicant needs none',
    '$.visa_embassy': 'only filled when a visa is required, and the e2e applicant needs none',
    '$.visa_street_and_house': 'only filled when a visa is required, and the e2e applicant needs none',
    '$.visa_postal_code': 'only filled when a visa is required, and the e2e applicant needs none',
    '$.visa_city': 'only filled when a visa is required, and the e2e applicant needs none',
    '$.visa_country': 'only filled when a visa is required, and the e2e applicant needs none',
};

test.describe('statutory application factories match the real API', () => {
    test('the own application and its permissions', async ({ api }) => {
        const event = await api.createStatutoryEvent();
        expectStatus(await api.call('admin', 'PUT', `/api/statutory/events/${event.id}/status`, { status: 'published' }), 200);
        const applied = await api.applyToStatutory('member', event);
        expectStatus(await api.call('member', 'PUT', `/api/statutory/events/${event.id}/applications/me`, { allergies: 'Nuts' }), 200);
        // The board's fields, so they have a value to compare.
        expectStatus(await api.call('admin', 'PUT', `/api/statutory/events/${event.id}/applications/${applied.id}/board`, {
            board_comment: 'Active member', participant_type: 'delegate', participant_order: 1
        }), 200);

        // As someone who manages applications, who gets every field.
        const managed = await api.call<Envelope<unknown>>('admin', 'GET', `/api/statutory/events/${event.id}/applications/${applied.id}`);
        expectStatus(managed, 200);
        expectShape('statutoryApplication', statutoryApplication({ board_comment: 'x', participant_type: 'delegate', participant_order: 1 }), managed.body.data, { gaps: unfilled });

        // The applicant's own: no board comment (statutory #2399), the bodies they may move it to.
        const mine = await api.call<Envelope<{ permissions: unknown }>>('member', 'GET', `/api/statutory/events/${event.id}/applications/me`);
        expectStatus(mine, 200);
        expectShape('singleStatutoryApplication', singleStatutoryApplication({
            participant_type: 'delegate', participant_order: 1, editable_bodies: [body()]
        }), mine.body.data, {
            ignore: { ...perBody.ignore, '$.editable_bodies': 'bodies of core, compared with the body factory in core-contract.spec.ts' },
            gaps: unfilled
        });
        expectShape('applicationPermissions', applicationPermissions(), mine.body.data.permissions);
    });

    test('the lists of applications and the pax limit of a body', async ({ api }) => {
        const event = await api.createStatutoryEvent();
        expectStatus(await api.call('admin', 'PUT', `/api/statutory/events/${event.id}/status`, { status: 'published' }), 200);
        const applied = await api.applyToStatutory('member', event);
        const bodyId = (await api.me('member')).bodies[0].id;
        expectStatus(await api.call('member', 'PUT', `/api/statutory/events/${event.id}/applications/me`, { allergies: 'Nuts' }), 200);
        // Accepted and with a place, so it is on the incoming list and its fields have values.
        expectStatus(await api.call('admin', 'PUT', `/api/statutory/events/${event.id}/applications/${applied.id}/board`, {
            board_comment: 'Active member', participant_type: 'delegate', participant_order: 1
        }), 200);
        expectStatus(await api.call('admin', 'PUT', `/api/statutory/events/${event.id}/applications/${applied.id}/status`, { status: 'accepted' }), 200);
        const withPlace = { board_comment: 'x', participant_type: 'delegate' as const, participant_order: 1 };

        const all = await api.call<Envelope<unknown[]>>('admin', 'GET', `/api/statutory/events/${event.id}/applications/all`);
        expectStatus(all, 200);
        expectShape('listedApplication', listedApplication(withPlace), all.body.data[0], { gaps: unfilled });

        const boardview = await api.call<Envelope<unknown[]>>('admin', 'GET', `/api/statutory/events/${event.id}/applications/boardview/${bodyId}`);
        expectStatus(boardview, 200);
        expectShape('listedApplication', listedApplication(withPlace), boardview.body.data[0], { gaps: unfilled });

        const incoming = await api.call<Envelope<unknown[]>>('admin', 'GET', `/api/statutory/events/${event.id}/applications/incoming`);
        expectStatus(incoming, 200);
        expectShape('incomingApplication', incomingApplication(), incoming.body.data[0], {
            gaps: Object.fromEntries(Object.entries(unfilled).filter(([path]) => path !== '$.email'))
        });

        // The member's antenna has no limit of its own: the default of an antenna.
        const limit = await api.call<Envelope<unknown>>('member', 'GET', `/api/statutory/limits/agora/${bodyId}`);
        expectStatus(limit, 200);
        expectShape('paxLimit', paxLimit(), limit.body.data);
    });
});
