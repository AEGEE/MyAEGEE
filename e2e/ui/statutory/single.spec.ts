// Statutory event page (/statutory/:id): the facts and deadlines of an Agora, EPM or SPM, the
// pages the viewer may go on to, publishing, and the event's picture.
import fs from 'node:fs';
import path from 'node:path';

import type { Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { FIXED_NOW, forbidden, iso, notFound, ok, unprocessable } from '../support/factories/base.ts';
import { body } from '../support/factories/core.ts';
import {
    allStatutoryPermissions,
    statusChangeResult,
    statutoryEvent,
    statutoryEventPermissions,
    statutoryEventSummary,
    statutoryImage,
    statutoryOrganiserPermissions,
    type StatutoryEvent,
    type StatutoryEventPermissions
} from '../support/factories/statutory-events.ts';
import { mockMap } from '../support/map.ts';
import { dialog, freezeTime, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const PICTURE = fs.readFileSync(path.join(import.meta.dirname, '../fixtures/statutory/agora-logo.png'));
const ALPHA = body({ id: 10, name: 'AEGEE-Alpha' });

// The value next to a label in the facts table.
const fact = (page: Page, label: string) => page.getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: label, exact: true }) })
    .getByRole('cell');
// The row of a deadline: its start and end.
const deadline = (page: Page, label: string) => page.getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: label, exact: true }) })
    .getByRole('cell');

const showEvent = (api: ApiMock, data: StatutoryEvent): void => {
    api.on('GET statutory /events/:id', ({ params }) => (params.id === data.url || params.id === String(data.id)
        ? { json: ok(data) }
        : { status: 404, json: notFound('Event with such url or ID is not found.') }));
    api.json('GET core /bodies/:id', ok(ALPHA));
};

const agora = (overrides: Partial<StatutoryEvent> = {}): StatutoryEvent => statutoryEvent({
    id: 5,
    url: 'agora-spring',
    name: 'Agora Spring',
    body_id: 10,
    ...overrides
});

// The buttons of the page that lead somewhere, with the permission that gives each of them.
const ACTIONS: [string, Partial<StatutoryEventPermissions>, string][] = [
    ['View applications', { see_applications: true }, '/applications'],
    ['Manage incoming info', { see_applications_incoming: true }, '/incoming'],
    ['Manage juridical info', { see_applications_juridical: true }, '/juridical'],
    ['Manage members list status', { see_applications_network: true }, '/network'],
    ['Export participants info', { export: { all: true, incoming: false, openslides: false, delegates_jc: false } }, '/applications/export'],
    ['Export participants info', { export: { all: false, incoming: true, openslides: false, delegates_jc: false } }, '/applications/export'],
    ['Export participants info', { export: { all: false, incoming: false, openslides: true, delegates_jc: false } }, '/applications/export'],
    ['Manage/view plenaries', { see_plenaries: true }, '/plenaries'],
    ['Manage/view plenaries', { manage_plenaries: true }, '/plenaries'],
    ['Participants list', { see_participants_list: true }, '/accepted'],
    ['Board view', { see_boardview: { global: true, 1: false } }, '/boardview'],
    ['Board view', { see_boardview: { global: false, 1: true } }, '/boardview'],
    ['Manage members list', { see_memberslist: { global: false, 1: true } }, '/memberslist/upload'],
    ['See members lists', { see_memberslist: { global: true, 1: false } }, '/memberslist/list'],
    ['See missing members lists', { see_missing_memberslist: { global: true } }, '/memberslist/list/missing'],
    ['See members lists without fee', { see_memberslist_without_fee: { global: true } }, '/memberslist/list/without_fee'],
    ['Mass mailer', { use_massmailer: true }, '/massmailer'],
    ['Manage candidates', { manage_candidates: true }, '/positions/all'],
    ['Question lines', { see_questions: true }, '/question-lines'],
    ['Question lines', { manage_question_lines: true }, '/question-lines'],
    ['Edit event', { edit_event: true }, '/edit']
];
const PERMISSION_LINKS = [...new Set(ACTIONS.map(([label]) => label))];
const AGORA_ONLY_LINKS = ['Manage members list', 'See members lists', 'See missing members lists', 'See members lists without fee', 'Manage candidates', 'View candidates', 'Manage/view plenaries'];
const AGORA_ONLY_DEADLINES = ['Members list upload period', 'Members list edit period', 'Draft proposals', 'Final proposals', 'Candidatures', 'Documents publication', 'Updated documents publication'];

test.describe('statutory event page', () => {
    test('a member sees the facts and deadlines of an Agora, and where to apply', async ({ page, api }) => {
        showEvent(api, agora({
            description: 'The **Spring Agora** of the network.',
            booklet_folder: 'https://wiki.example.org/agora',
            fee: 75,
            // The dates are shown in the browser's time zone (Brussels, summer time here).
            starts: '2027-07-15T08:00:00.000Z',
            ends: '2027-07-18T14:00:00.000Z',
            application_period_starts: '2027-05-01T08:00:00.000Z',
            application_period_ends: '2027-05-31T21:00:00.000Z',
            board_approve_deadline: '2027-06-05T10:00:00.000Z',
            participants_list_publish_deadline: '2027-06-08T10:00:00.000Z',
            memberslist_submission_deadline: '2027-06-20T10:00:00.000Z',
            memberslist_edit_deadline: '2027-07-01T08:00:00.000Z',
            draft_proposal_deadline: '2027-05-25T10:00:00.000Z',
            final_proposal_deadline: '2027-06-10T10:00:00.000Z',
            candidature_deadline: '2027-06-25T10:00:00.000Z',
            booklet_publication_deadline: '2027-06-28T10:00:00.000Z',
            updated_booklet_publication_deadline: '2027-07-08T10:00:00.000Z'
        }));

        await page.goto('/statutory/agora-spring');

        await expect(page.getByRole('heading', { name: 'Agora Spring', level: 1 })).toBeVisible();
        await expect(page).toHaveTitle('MyAEGEE | Display single event');
        await expect(fact(page, 'Event name')).toHaveText('Agora Spring');
        await expect(fact(page, 'Description').getByText('Spring Agora')).toHaveJSProperty('tagName', 'STRONG');
        await expect(fact(page, 'KMS page').getByRole('link')).toHaveAttribute('href', 'https://wiki.example.org/agora');
        await expect(fact(page, 'KMS page').getByRole('link')).toHaveAttribute('target', '_blank');
        await expect(fact(page, 'Type')).toHaveText('Agora');
        await expect(fact(page, 'Starts')).toHaveText('2027-07-15');
        await expect(fact(page, 'Ends')).toHaveText('2027-07-18');
        await expect(fact(page, 'Fee')).toHaveText('€75');
        await expect(fact(page, 'Organising body').getByRole('link', { name: 'AEGEE-Alpha' })).toHaveAttribute('href', '/bodies/10');
        await expect(page.getByText('This event is fully vegetarian!')).toHaveCount(0);

        await expect(page.getByRole('heading', { name: 'Deadlines' })).toBeVisible();
        await expect(deadline(page, 'Application period')).toHaveText(['2027-05-01 10:00', '2027-05-31 23:00']);
        await expect(deadline(page, 'Board approval')).toHaveText(['2027-05-01 10:00', '2027-06-05 12:00']);
        await expect(deadline(page, 'Participants list publishing')).toHaveText('2027-06-08 12:00');
        await expect(deadline(page, 'Members list upload period')).toHaveText(['2027-05-01 10:00', '2027-06-20 12:00']);
        await expect(deadline(page, 'Members list edit period')).toHaveText(['2027-05-01 10:00', '2027-07-01 10:00']);
        await expect(deadline(page, 'Draft proposals')).toHaveText('2027-05-25 12:00');
        await expect(deadline(page, 'Final proposals')).toHaveText('2027-06-10 12:00');
        await expect(deadline(page, 'Candidatures')).toHaveText('2027-06-25 12:00');
        await expect(deadline(page, 'Documents publication')).toHaveText('2027-06-28 12:00');
        await expect(deadline(page, 'Updated documents publication')).toHaveText('2027-07-08 12:00');

        // What every member may do.
        await expect(page.getByRole('link', { name: 'Applications stats' })).toHaveAttribute('href', '/statutory/agora-spring/applications/stats');
        await expect(page.getByRole('link', { name: 'My application' })).toHaveAttribute('href', '/statutory/agora-spring/applications/me');
        await expect(page.getByRole('link', { name: 'View candidates' })).toHaveAttribute('href', '/statutory/agora-spring/positions/approved');
        for (const label of PERMISSION_LINKS) {
            await expect(page.getByRole('link', { name: label, exact: true })).toHaveCount(0);
        }
        for (const label of ['Change picture', 'Publish', 'Unpublish']) {
            await expect(page.getByRole('button', { name: label })).toHaveCount(0);
        }
    });

    for (const type of ['epm', 'spm'] as const) {
        test(`an ${type.toUpperCase()} has none of the Agora's deadlines and pages, whatever the viewer may do`, async ({ page, api }) => {
            showEvent(api, agora({ type, url: `${type}-spring`, name: 'Spring meeting', permissions: allStatutoryPermissions() }));

            await page.goto(`/statutory/${type}-spring`);

            await expect(fact(page, 'Type')).toHaveText(type.toUpperCase());
            await expect(deadline(page, 'Application period')).toHaveCount(2);
            for (const label of AGORA_ONLY_DEADLINES) {
                await expect(page.getByRole('rowheader', { name: label, exact: true })).toHaveCount(0);
            }
            for (const label of AGORA_ONLY_LINKS) {
                await expect(page.getByRole('link', { name: label, exact: true })).toHaveCount(0);
            }
            await expect(page.getByRole('link', { name: 'View applications' })).toHaveAttribute('href', `/statutory/${type}-spring/applications`);
            await expect(page.getByRole('link', { name: 'Mass mailer' })).toBeVisible();
        });
    }

    for (const [label, permissions, suffix] of ACTIONS) {
        test(`${label} is offered with ${JSON.stringify(permissions)}`, async ({ page, api }) => {
            showEvent(api, agora({ permissions: statutoryEventPermissions(permissions) }));

            await page.goto('/statutory/agora-spring');

            await expect(page.getByRole('link', { name: label, exact: true })).toHaveAttribute('href', `/statutory/agora-spring${suffix}`);
        });
    }

    test('only the export of delegates for the JC gives no export page', async ({ page, api }) => {
        showEvent(api, agora({ permissions: statutoryEventPermissions({ export: { all: false, incoming: false, openslides: false, delegates_jc: true } }) }));

        await page.goto('/statutory/agora-spring');

        await expect(page.getByRole('link', { name: 'My application' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Export participants info' })).toHaveCount(0);
    });

    test('organisers can change the picture, edit and unpublish the event', async ({ page, api }) => {
        showEvent(api, agora({ permissions: statutoryOrganiserPermissions() }));

        await page.goto('/statutory/agora-spring');

        await expect(page.getByRole('button', { name: 'Change picture' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Edit event' })).toHaveAttribute('href', '/statutory/agora-spring/edit');
        await expect(page.getByRole('button', { name: 'Unpublish' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Publish', exact: true })).toHaveCount(0);
    });

    test('the plenaries are only offered for an Agora', async ({ page, api }) => {
        showEvent(api, agora({ type: 'epm', url: 'epm-spring', permissions: statutoryEventPermissions({ see_plenaries: true, manage_plenaries: true }) }));

        await page.goto('/statutory/epm-spring');

        await expect(page.getByRole('link', { name: 'My application' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Manage/view plenaries' })).toHaveCount(0);
    });

    test('the links of an event without a URL use its id', async ({ page, api }) => {
        showEvent(api, agora({ id: 14, url: '', permissions: statutoryOrganiserPermissions() }));

        await page.goto('/statutory/14');

        await expect(page.getByRole('link', { name: 'My application' })).toHaveAttribute('href', '/statutory/14/applications/me');
        await expect(page.getByRole('link', { name: 'Edit event' })).toHaveAttribute('href', '/statutory/14/edit');
    });

    test('shows the event\'s picture, or the logo without one', async ({ page, api }) => {
        showEvent(api, agora({ image_id: 3, image: statutoryImage({ frontend_path: '/agora-logo.png' }) }));
        api.url('GET', '/media/statutory/agora-logo.png', { body: PICTURE, contentType: 'image/png' });

        await page.goto('/statutory/agora-spring');

        await expect(page.getByRole('img', { name: 'Agora Spring' })).toHaveAttribute('src', '/media/statutory/agora-logo.png');
    });

    test('a free event says so, and a vegetarian one too', async ({ page, api }) => {
        showEvent(api, agora({ fee: 0, vegetarian: true, booklet_folder: null }));

        await page.goto('/statutory/agora-spring');

        await expect(fact(page, 'Fee')).toHaveText('Free');
        await expect(page.getByText('This event is fully vegetarian!')).toBeVisible();
        await expect(page.getByRole('rowheader', { name: 'KMS page' })).toHaveCount(0);
    });

    test('a KMS link that is no web address can\'t be opened', async ({ page, api }) => {
        // eslint-disable-next-line no-script-url -- the link the page must not make clickable
        showEvent(api, agora({ booklet_folder: 'javascript:alert(1)' }));

        await page.goto('/statutory/agora-spring');

        // eslint-disable-next-line no-script-url -- the link the page must not make clickable
        await expect(fact(page, 'KMS page')).toHaveText('javascript:alert(1)');
        await expect(fact(page, 'KMS page').getByRole('link')).toHaveCount(0);
    });

    test('a KMS link without a scheme opens as https', async ({ page, api }) => {
        showEvent(api, agora({ booklet_folder: 'wiki.example.org/agora' }));

        await page.goto('/statutory/agora-spring');

        await expect(fact(page, 'KMS page').getByRole('link')).toHaveAttribute('href', 'https://wiki.example.org/agora');
    });

    test('the organising body shows as "Loading..." until it is known', async ({ page, api }) => {
        showEvent(api, agora());
        api.on('GET core /bodies/:id', { json: ok(ALPHA), delayMs: 1000 });

        await page.goto('/statutory/agora-spring');

        await expect(fact(page, 'Organising body')).toHaveText('Loading...');
        await expect(fact(page, 'Organising body')).toHaveText('AEGEE-Alpha');
        expect(api.callsTo('GET core /bodies/:id').map((call) => call.params.id)).toEqual(['10']);
    });

    test('the description is shown as markdown without running scripts', async ({ page, api }) => {
        showEvent(api, agora({ description: '**bold** <img src=x onerror="window.__xss=1"><script>window.__xss=2</script> [x](javascript:window.__xss=3)' }));
        const picture = new Promise<void>((resolve) => {
            api.url('GET', '/statutory/x', () => {
                resolve();
                return { status: 404, body: '' };
            });
        });

        await page.goto('/statutory/agora-spring');

        await expect(fact(page, 'Description').getByText('bold')).toHaveJSProperty('tagName', 'STRONG');
        await expect(fact(page, 'Description').getByText('x', { exact: true })).not.toHaveAttribute('href', /javascript:/);
        await picture;
        expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    });

    test.describe('application ban', () => {
        const now = Date.parse(FIXED_NOW);

        test('a member whose ban is still running is told until when', async ({ page, api, me }) => {
            await freezeTime(page);
            me!.event_application_ban = { ban_until: '2027-03-15T10:00:00.000Z' };
            showEvent(api, agora());

            await page.goto('/statutory/agora-spring');

            await expect(page.getByText('You are temporarily banned from submitting new event applications until 2027-03-15 11:00.')).toBeVisible();
            await expect(page.getByText('Existing applications can still be managed and position applications remain available.')).toBeVisible();
        });

        test('a ban that has ended is not mentioned', async ({ page, api, me }) => {
            await freezeTime(page);
            me!.event_application_ban = { ban_until: iso(-14, now) };
            showEvent(api, agora());

            await page.goto('/statutory/agora-spring');

            await expect(fact(page, 'Organising body')).toHaveText('AEGEE-Alpha');
            await expect(page.getByText(/temporarily banned/)).toHaveCount(0);
        });
    });

    test.describe('publishing', () => {
        test('an organiser unpublishes the event after confirming', async ({ page, api }) => {
            showEvent(api, agora({ permissions: statutoryOrganiserPermissions() }));
            api.json('PUT statutory /events/:id/status', statusChangeResult());

            await page.goto('/statutory/agora-spring');
            await page.getByRole('button', { name: 'Unpublish' }).click();

            const confirm = dialog(page, 'Switching status');
            await expect(confirm).toContainText('Are you sure you want to switch this event\'s status to "draft"?');
            await confirm.getByRole('button', { name: 'Switch status' }).click();

            await expect(toast(page, 'Status is updated.')).toBeVisible();
            await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeVisible();
            await expect(page.getByRole('button', { name: 'Unpublish' })).toHaveCount(0);
            // The numeric id, whatever the address of the page is.
            expect(api.callsTo('PUT statutory /events/:id/status').map((call) => [call.params.id, call.body])).toEqual([['5', { status: 'draft' }]]);
        });

        test('an organiser publishes a draft', async ({ page, api }) => {
            showEvent(api, agora({ status: 'draft', permissions: statutoryOrganiserPermissions({ apply: false }) }));
            api.json('PUT statutory /events/:id/status', statusChangeResult());

            await page.goto('/statutory/agora-spring');
            await page.getByRole('button', { name: 'Publish', exact: true }).click();
            const confirm = dialog(page, 'Switching status');
            await expect(confirm).toContainText('switch this event\'s status to "published"');
            await confirm.getByRole('button', { name: 'Switch status' }).click();

            await expect(toast(page, 'Status is updated.')).toBeVisible();
            await expect(page.getByRole('button', { name: 'Unpublish' })).toBeVisible();
            expect(api.callsTo('PUT statutory /events/:id/status').map((call) => call.body)).toEqual([{ status: 'published' }]);
        });

        test('cancelling changes nothing', async ({ page, api }) => {
            showEvent(api, agora({ permissions: statutoryOrganiserPermissions() }));

            await page.goto('/statutory/agora-spring');
            await page.getByRole('button', { name: 'Unpublish' }).click();
            await dialog(page, 'Switching status').getByRole('button', { name: 'Cancel' }).click();

            await expect(dialog(page, 'Switching status')).toHaveCount(0);
            await expect(page.getByRole('button', { name: 'Unpublish' })).toBeVisible();
            expect(api.callsTo('PUT statutory /events/:id/status')).toEqual([]);
        });

        test('a refused change says why and keeps the status', async ({ page, api }) => {
            showEvent(api, agora({ permissions: statutoryOrganiserPermissions() }));
            api.on('PUT statutory /events/:id/status', { status: 403, json: forbidden('You are not allowed to change status for events of this type.') });

            await page.goto('/statutory/agora-spring');
            await page.getByRole('button', { name: 'Unpublish' }).click();
            await dialog(page, 'Switching status').getByRole('button', { name: 'Switch status' }).click();

            await expect(toast(page, 'Could not update status: You are not allowed to change status for events of this type.')).toBeVisible();
            await expect(page.getByRole('button', { name: 'Unpublish' })).toBeVisible();
        });
    });

    test.describe('drafts', () => {
        test('a member who opens the address of a draft is told it doesn\'t exist', async ({ page, api }) => {
            // The service answers a draft like an unknown event, unless the viewer manages events of its type.
            api.on('GET statutory /events/:id', { status: 404, json: notFound('Event with such url or ID is not found.') });
            api.json('GET statutory /', ok([]));

            await page.goto('/statutory/agora-draft');

            await expect(toast(page, 'Event is not found')).toBeVisible();
            await expect(page).toHaveURL('/statutory');
        });

        test('a manager of events of its type sees the draft, and nobody can apply to it', async ({ page, api }) => {
            showEvent(api, agora({ status: 'draft', can_apply: true, permissions: statutoryOrganiserPermissions({ apply: false }) }));

            await page.goto('/statutory/agora-spring');

            await expect(page.getByRole('heading', { name: 'Agora Spring', level: 1 })).toBeVisible();
            await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeVisible();
            // Rik, 2026-11-23 (A32): stays offered; the application page says no.
            await expect(page.getByRole('link', { name: 'My application' })).toBeVisible();
        });
    });

    test.describe('when the event can\'t be shown', () => {
        test('an unknown event goes back to the list', async ({ page, api }) => {
            showEvent(api, agora());
            api.json('GET core /bodies/:id', ok(ALPHA), { optional: 'the body of an event that is not found is never asked for' });
            api.json('GET statutory /', ok([]));

            await page.goto('/statutory/no-such-event');

            await expect(toast(page, 'Event is not found')).toBeVisible();
            await expect(page).toHaveURL('/statutory');
        });

        test('a failing service goes back to the list', async ({ page, api }) => {
            api.on('GET statutory /events/:id', { status: 500, json: { success: false, message: 'Internal server error.' } });
            api.json('GET statutory /', ok([]));

            await page.goto('/statutory/agora-spring');

            await expect(toast(page, 'Some error happened: Internal server error.')).toBeVisible();
            await expect(page).toHaveURL('/statutory');
        });

        test('an event whose body can\'t be loaded is shown all the same', async ({ page, api }) => {
            showEvent(api, agora());
            api.on('GET core /bodies/:id', { status: 500, json: { success: false, message: 'Something went wrong on the server.' } });

            await page.goto('/statutory/agora-spring');

            await expect(toast(page, 'Could not fetch the organising body: Something went wrong on the server.')).toBeVisible();
            await expect(fact(page, 'Organising body')).toHaveText('Unknown body');
            await expect(page.getByRole('heading', { name: 'Agora Spring', level: 1 })).toBeVisible();
            await expect(page).toHaveURL('/statutory/agora-spring');
        });
    });

    test.describe('map', () => {
        test('an event without locations has no map', async ({ page, api }) => {
            showEvent(api, agora({ locations: [] }));

            await page.goto('/statutory/agora-spring');

            await expect(fact(page, 'Organising body')).toHaveText('AEGEE-Alpha');
            await expect(page.getByLabel('Map', { exact: true })).toHaveCount(0);
        });

        for (const locations of [
            [{ name: 'Plenary hall', position: { lat: 50.85, lng: 4.35 } }],
            [{ name: 'Plenary hall', position: { lat: 50.85, lng: 4.35 } }, { name: 'Party hall', position: { lat: 50.9, lng: 4.4 } }, { name: 'Hostel', position: { lat: 50.8, lng: 4.3 } }]
        ]) {
            test(`an event with ${locations.length} location${locations.length === 1 ? '' : 's'} shows them on a map`, async ({ page, api }) => {
                mockMap(api);
                showEvent(api, agora({ locations }));

                await page.goto('/statutory/agora-spring');

                await expect(page.getByLabel('Map', { exact: true })).toBeVisible();
                await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible();
            });
        }

        test('the map waits for the event when it loads first', async ({ page, api }) => {
            mockMap(api);
            showEvent(api, agora({ locations: [{ name: 'Plenary hall', position: { lat: 50.85, lng: 4.35 } }] }));
            api.on('GET core /bodies/:id', { json: ok(ALPHA), delayMs: 1500 });

            await page.goto('/statutory/agora-spring');

            await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible();
            await expect(fact(page, 'Organising body')).toHaveText('AEGEE-Alpha');
        });
    });

    test.describe('picture', () => {
        const openModal = async (page: Page, api: ApiMock, data = agora({ permissions: statutoryOrganiserPermissions() })) => {
            showEvent(api, data);
            await page.goto(`/statutory/${data.url}`);
            await page.getByRole('button', { name: 'Change picture' }).click();
            return dialog(page, 'Change picture');
        };

        test('an organiser uploads a new picture, and the page shows it', async ({ page, api }) => {
            api.json('POST statutory /events/:id/image', ok(statutoryEventSummary({ id: 5, image_id: 9, image: statutoryImage({ id: 9, file_name: 'new.png', frontend_path: '/new.png' }) })));
            api.url('GET', '/media/statutory/new.png', { body: PICTURE, contentType: 'image/png' });
            const modal = await openModal(page, api);

            await expect(modal.getByRole('heading', { name: 'Change picture' })).toBeVisible();
            await expect(modal).toContainText('Not set.');
            await expect(modal.getByRole('button', { name: 'Upload!' })).toBeDisabled();
            const file = modal.getByLabel(/Choose a file/);
            await expect(file).toHaveAttribute('accept', '.png,.jpg,.jpeg');
            await file.setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PICTURE });
            await expect(modal).toContainText('logo.png');
            await modal.getByRole('button', { name: 'Upload!' }).click();

            await expect(toast(page, 'Event image is updated.')).toBeVisible();
            await expect(modal).toHaveCount(0);
            await expect(page.getByRole('img', { name: 'Agora Spring' })).toHaveAttribute('src', '/media/statutory/new.png');
            const [upload] = api.callsTo('POST statutory /events/:id/image');
            expect(upload.params.id).toBe('5');
            expect(upload.parts.map(({ name, filename, contentType }) => ({ name, filename, contentType }))).toEqual([{ name: 'image', filename: 'logo.png', contentType: 'image/png' }]);
            // The page isn't loaded again for it.
            expect(api.callsTo('GET statutory /events/:id')).toHaveLength(1);
        });

        test('a refused picture says why and keeps the modal open', async ({ page, api }) => {
            api.on('POST statutory /events/:id/image', { status: 422, json: unprocessable('Malformed file content.') });
            const modal = await openModal(page, api);

            await modal.getByLabel(/Choose a file/).setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from('not a picture') });
            await modal.getByRole('button', { name: 'Upload!' }).click();

            await expect(toast(page, 'Could not update image: Malformed file content.')).toBeVisible();
            await expect(modal).toBeVisible();
        });

        test('the close button closes the modal', async ({ page, api }) => {
            const modal = await openModal(page, api);

            await modal.getByRole('button', { name: 'Close' }).click();

            await expect(modal).toHaveCount(0);
            expect(api.callsTo('POST statutory /events/:id/image')).toEqual([]);
        });
    });
});
