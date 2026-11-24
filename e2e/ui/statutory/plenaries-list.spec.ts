// Plenaries of an Agora (/statutory/:id/plenaries): the list, creating and editing a plenary in
// its modal, and the export of the attendance statistics.
import fs from 'node:fs';

import type { Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { forbidden, notFound, ok, validationError } from '../support/factories/base.ts';
import { statutoryEvent, statutoryEventPermissions, type StatutoryEventPermissions } from '../support/factories/statutory-events.ts';
import { statutoryPlenary, type StatutoryPlenary } from '../support/factories/statutory-plenaries.ts';
import { cellOf, dialog, expectEmptyTable, fillDate, freezeTime, tableRows, toast } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { test, expect } from '../support/test.ts';

const CHAIR = statutoryEventPermissions({ manage_plenaries: true, see_plenaries: true, mark_attendance: true });

// One in winter time, one in summer time: the page shows them in Brussels time.
const FIRST = statutoryPlenary({ id: 2, event_id: 5, name: 'Opening plenary', starts: '2027-03-02T08:00:00.000Z', ends: '2027-03-02T12:30:15.000Z' });
const SECOND = statutoryPlenary({ id: 3, event_id: 5, name: 'Elections', starts: '2027-07-15T07:00:00.000Z', ends: '2027-07-15T16:00:00.000Z' });

// What the list of plenaries answers from now on.
const answerPlenaries = (api: ApiMock, plenaries: StatutoryPlenary[]): void => {
    api.json('GET statutory /events/:id/plenaries', ok(plenaries));
};

const showPlenaries = (api: ApiMock, plenaries: StatutoryPlenary[] = [FIRST, SECOND], permissions: StatutoryEventPermissions = CHAIR): void => {
    api.json('GET statutory /events/:id', ok(statutoryEvent({ id: 5, url: 'agora-spring', permissions })));
    answerPlenaries(api, plenaries);
};

const plenariesTable = (page: Page) => page.getByRole('table');
const rowOf = (page: Page, name: string) => tableRows(plenariesTable(page)).filter({ hasText: name });
const modal = (page: Page, name = 'Add plenary') => dialog(page, name);

test.describe('plenaries of an Agora', () => {
    test('the chair sees the plenaries with their times, and can create, edit and open them', async ({ page, api }) => {
        showPlenaries(api);

        await page.goto('/statutory/agora-spring/plenaries');

        await expect(page.getByRole('heading', { name: 'Plenaries list', exact: true })).toBeVisible();
        await expect(page).toHaveTitle('MyAEGEE | Plenaries list for Agora');
        const table = plenariesTable(page);
        await expect(tableRows(table)).toHaveCount(2);
        const first = rowOf(page, 'Opening plenary');
        await expect(await cellOf(table, first, '#')).toHaveText('2');
        await expect(await cellOf(table, first, 'Starts')).toHaveText('2027-03-02 09:00:00');
        await expect(await cellOf(table, first, 'Ends')).toHaveText('2027-03-02 13:30:15');
        await expect(first.getByRole('link', { name: 'View/mark attendances' })).toHaveAttribute('href', '/statutory/agora-spring/plenaries/2');
        await expect(first.getByRole('button', { name: 'Edit' })).toBeVisible();
        const second = rowOf(page, 'Elections');
        await expect(await cellOf(table, second, 'Starts')).toHaveText('2027-07-15 09:00:00');
        await expect(await cellOf(table, second, 'Ends')).toHaveText('2027-07-15 18:00:00');
        await expect(page.getByRole('button', { name: 'Create a plenary' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Export stats' })).toBeVisible();

        api.fallback(mockEverything);
        await first.getByRole('link', { name: 'View/mark attendances' }).click();
        await expect(page).toHaveURL('/statutory/agora-spring/plenaries/2');
    });

    test('who may only see the plenaries can open and export them, not create or edit them', async ({ page, api }) => {
        showPlenaries(api, [FIRST], statutoryEventPermissions({ see_plenaries: true }));

        await page.goto('/statutory/agora-spring/plenaries');

        const first = rowOf(page, 'Opening plenary');
        await expect(first.getByRole('link', { name: 'View/mark attendances' })).toBeVisible();
        await expect(first.getByRole('button', { name: 'Edit' })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Export stats' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Create a plenary' })).toHaveCount(0);
    });

    test('an Agora without plenaries says so', async ({ page, api }) => {
        showPlenaries(api, []);

        await page.goto('/statutory/agora-spring/plenaries');

        await expectEmptyTable(plenariesTable(page));
    });

    test('a new plenary starts and ends now until the chair sets its times', async ({ page, api }) => {
        await freezeTime(page);
        showPlenaries(api);

        await page.goto('/statutory/agora-spring/plenaries');
        await page.getByRole('button', { name: 'Create a plenary' }).click();

        const form = modal(page);
        await expect(form.getByRole('heading', { name: 'Add plenary' })).toBeVisible();
        await expect(form.getByLabel('Name')).toHaveValue('');
        await expect(form.getByLabel('Starts')).toHaveValue('2027-03-01 10:00');
        await expect(form.getByLabel('Ends')).toHaveValue('2027-03-01 10:00');
    });

    test('the chair creates a plenary, and the list shows it without reloading the page', async ({ page, api }) => {
        await freezeTime(page);
        showPlenaries(api, [FIRST]);
        const created = statutoryPlenary({ id: 4, event_id: 5, name: 'Closing plenary', starts: '2027-03-04T09:00:00.000Z', ends: '2027-03-04T11:00:00.000Z' });
        api.json('POST statutory /events/:id/plenaries', ok(created));

        await page.goto('/statutory/agora-spring/plenaries');
        await page.getByRole('button', { name: 'Create a plenary' }).click();
        const form = modal(page);
        await form.getByLabel('Name').fill('Closing plenary');
        await fillDate(form.getByLabel('Starts'), '2027-03-04 10:00');
        await fillDate(form.getByLabel('Ends'), '2027-03-04 12:00');
        // The list has the new plenary from now on.
        answerPlenaries(api, [FIRST, created]);
        await form.getByRole('button', { name: 'Save changes' }).click();

        await expect(toast(page, 'Plenary is created.')).toBeVisible();
        await expect(form).toHaveCount(0);
        await expect(await cellOf(plenariesTable(page), rowOf(page, 'Closing plenary'), 'Starts')).toHaveText('2027-03-04 10:00:00');
        // Sent to the event's id, not to its URL.
        expect(api.callsTo('POST statutory /events/:id/plenaries').map((call) => [call.params, call.body])).toEqual([[
            { id: '5' },
            { name: 'Closing plenary', starts: '2027-03-04T09:00:00.000Z', ends: '2027-03-04T11:00:00.000Z' }
        ]]);
        expect(api.callsTo('GET statutory /events/:id/plenaries')).toHaveLength(2);
    });

    test('a plenary is saved once, however often Save is clicked', async ({ page, api }) => {
        await freezeTime(page);
        showPlenaries(api, []);
        api.on('POST statutory /events/:id/plenaries', { json: ok(statutoryPlenary({ event_id: 5 })), delayMs: 1000 });

        await page.goto('/statutory/agora-spring/plenaries');
        await page.getByRole('button', { name: 'Create a plenary' }).click();
        const form = modal(page);
        await form.getByLabel('Name').fill('Plenary 1');
        await fillDate(form.getByLabel('Ends'), '2027-03-01 14:00');
        const save = form.getByRole('button', { name: 'Save changes' });
        await save.click();

        await expect(save).toBeDisabled();
        await expect(toast(page, 'Plenary is created.')).toBeVisible();
        expect(api.callsTo('POST statutory /events/:id/plenaries')).toHaveLength(1);
    });

    test('what the service refuses is shown at the fields, and the modal stays open', async ({ page, api }) => {
        await freezeTime(page);
        showPlenaries(api);
        // An emptied start is refused as not set, a start after the end at the end.
        api.on('POST statutory /events/:id/plenaries', ({ body }) => ({
            status: 422,
            json: validationError((body as { starts: string | null }).starts === null
                ? { starts: ['plenary.starts cannot be null'], name: ['Plenary name should be set.'] }
                : { name: ['Plenary name should be set.'], ends: ['Plenary cannot start after or at the same time it ends.'] })
        }));

        await page.goto('/statutory/agora-spring/plenaries');
        await page.getByRole('button', { name: 'Create a plenary' }).click();
        const form = modal(page);
        await form.getByLabel('Starts').clear();
        await form.getByLabel('Starts').press('Enter');
        await form.getByRole('button', { name: 'Save changes' }).click();

        await expect(toast(page, 'Some fields were not set')).toBeVisible();
        await expect(form.getByText('Plenary name should be set.')).toBeVisible();
        await expect(form.getByText('plenary.starts cannot be null')).toBeVisible();
        await expect(form.getByRole('button', { name: 'Save changes' })).toBeEnabled();

        await fillDate(form.getByLabel('Starts'), '2027-03-01 15:00');
        await form.getByRole('button', { name: 'Save changes' }).click();

        await expect(form.getByText('Plenary cannot start after or at the same time it ends.')).toBeVisible();
        await expect(form.getByText('plenary.starts cannot be null')).toHaveCount(0);
        await expect(form.getByText('Plenary name should be set.')).toBeVisible();
        // An emptied date is sent as not set; the untouched end is the default, now.
        expect(api.callsTo('POST statutory /events/:id/plenaries').map((call) => call.body)).toEqual([
            { name: '', starts: null, ends: expect.stringMatching(/^2027-03-01T09:00:\d\d\.\d{3}Z$/) },
            { name: '', starts: '2027-03-01T14:00:00.000Z', ends: expect.stringMatching(/^2027-03-01T09:00:\d\d\.\d{3}Z$/) }
        ]);
    });

    test('a failure to save says why', async ({ page, api }) => {
        showPlenaries(api);
        api.on('POST statutory /events/:id/plenaries', { status: 500, json: { success: false, message: 'Internal server error.' } });

        await page.goto('/statutory/agora-spring/plenaries');
        await page.getByRole('button', { name: 'Create a plenary' }).click();
        await modal(page).getByLabel('Name').fill('Closing plenary');
        await modal(page).getByRole('button', { name: 'Save changes' }).click();

        await expect(toast(page, 'Some error happened: Internal server error.')).toBeVisible();
        await expect(modal(page)).toBeVisible();
    });

    test('the chair edits a plenary, and the list shows the saved one', async ({ page, api }) => {
        showPlenaries(api);
        const saved = { ...FIRST, name: 'Opening plenary (day 1)', ends: '2027-03-02T13:00:00.000Z' };
        api.json('PUT statutory /events/:id/plenaries/:plenary_id', ok(saved));

        await page.goto('/statutory/agora-spring/plenaries');
        await rowOf(page, 'Opening plenary').getByRole('button', { name: 'Edit' }).click();
        const form = modal(page, 'Edit plenary');
        await expect(form.getByRole('heading', { name: 'Edit plenary' })).toBeVisible();
        await expect(form.getByLabel('Name')).toHaveValue('Opening plenary');
        await expect(form.getByLabel('Starts')).toHaveValue('2027-03-02 09:00');
        await expect(form.getByLabel('Ends')).toHaveValue('2027-03-02 13:30');
        await form.getByLabel('Name').fill('Opening plenary (day 1)');
        await fillDate(form.getByLabel('Ends'), '2027-03-02 14:00');
        answerPlenaries(api, [saved, SECOND]);
        await form.getByRole('button', { name: 'Save changes' }).click();

        await expect(toast(page, 'Plenary is updated.')).toBeVisible();
        await expect(form).toHaveCount(0);
        await expect(await cellOf(plenariesTable(page), rowOf(page, 'Opening plenary (day 1)'), 'Ends')).toHaveText('2027-03-02 14:00:00');
        // Only the fields of the form are sent, to the plenary of the event's id.
        expect(api.callsTo('PUT statutory /events/:id/plenaries/:plenary_id').map((call) => [call.params, call.body])).toEqual([[
            { id: '5', plenary_id: '2' },
            { name: 'Opening plenary (day 1)', starts: '2027-03-02T08:00:00.000Z', ends: '2027-03-02T13:00:00.000Z' }
        ]]);
    });

    for (const close of ['Cancel', 'Close'] as const) {
        test(`"${close}" leaves the plenary as it was and sends nothing`, async ({ page, api }) => {
            showPlenaries(api);

            await page.goto('/statutory/agora-spring/plenaries');
            await rowOf(page, 'Opening plenary').getByRole('button', { name: 'Edit' }).click();
            const form = modal(page, 'Edit plenary');
            await form.getByLabel('Name').fill('Renamed plenary');
            await form.getByRole('button', { name: close, exact: true }).click();

            await expect(form).toHaveCount(0);
            await expect(rowOf(page, 'Opening plenary')).toHaveCount(1);
            await expect(rowOf(page, 'Renamed plenary')).toHaveCount(0);
            expect(api.callsTo('* statutory /events/:id/plenaries/:plenary_id')).toEqual([]);
        });
    }

    test('when the list can\'t be loaded again after saving, it says so', async ({ page, api }) => {
        showPlenaries(api, []);
        api.json('POST statutory /events/:id/plenaries', ok(statutoryPlenary({ event_id: 5 })));

        await page.goto('/statutory/agora-spring/plenaries');
        await expectEmptyTable(plenariesTable(page));
        api.on('GET statutory /events/:id/plenaries', { status: 500, json: { success: false, message: 'Internal server error.' } });
        await page.getByRole('button', { name: 'Create a plenary' }).click();
        await modal(page).getByLabel('Name').fill('Plenary 1');
        await modal(page).getByRole('button', { name: 'Save changes' }).click();

        await expect(toast(page, 'Plenary is created.')).toBeVisible();
        await expect(toast(page, 'Could not load the plenaries: Internal server error.')).toBeVisible();
    });

    test('the attendance statistics are downloaded as a spreadsheet', async ({ page, api }) => {
        await freezeTime(page);
        showPlenaries(api);
        const spreadsheet = Buffer.from('PK\u0003\u0004 the statistics');
        api.on('GET statutory /events/:id/plenaries/stats', {
            body: spreadsheet,
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        await page.goto('/statutory/agora-spring/plenaries');
        const download = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Export stats' }).click();

        // Named after the moment of the export (Chromium may write the colons differently).
        const file = await download;
        expect(file.suggestedFilename()).toMatch(/^plenaries_2027-03-01T09.00.\d\d\.\d{3}Z\.xlsx$/);
        expect(fs.readFileSync(await file.path())).toEqual(spreadsheet);
        expect(api.callsTo('GET statutory /events/:id/plenaries/stats').map((call) => call.params)).toEqual([{ id: 'agora-spring' }]);
    });

    test('the export button is busy until the statistics are there', async ({ page, api }) => {
        showPlenaries(api);
        api.on('GET statutory /events/:id/plenaries/stats', { body: Buffer.from('PK'), contentType: 'application/octet-stream', delayMs: 1000 });

        await page.goto('/statutory/agora-spring/plenaries');
        const download = page.waitForEvent('download');
        const button = page.getByRole('button', { name: 'Export stats' });
        await button.click();

        await expect(button).toBeDisabled();
        await download;
        await expect(button).toBeEnabled();
    });

    test('a refused export says why', async ({ page, api }) => {
        showPlenaries(api);
        api.on('GET statutory /events/:id/plenaries/stats', { status: 403, json: forbidden('You cannot see stats.') });

        await page.goto('/statutory/agora-spring/plenaries');
        await page.getByRole('button', { name: 'Export stats' }).click();

        await expect(toast(page, 'Could not export the statistics: You cannot see stats.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Export stats' })).toBeEnabled();
    });

    test('an export that fails without a message from the service says so', async ({ page, api }) => {
        showPlenaries(api);
        api.on('GET statutory /events/:id/plenaries/stats', { status: 502, body: Buffer.from('<html>Bad gateway</html>'), contentType: 'text/html' });

        await page.goto('/statutory/agora-spring/plenaries');
        await page.getByRole('button', { name: 'Export stats' }).click();

        await expect(toast(page, 'Could not export the statistics: Request failed with status code 502')).toBeVisible();
    });

    test('an export that can\'t reach the service says so', async ({ page, api }) => {
        showPlenaries(api);
        api.on('GET statutory /events/:id/plenaries/stats', { abort: 'failed' });

        await page.goto('/statutory/agora-spring/plenaries');
        await page.getByRole('button', { name: 'Export stats' }).click();

        await expect(toast(page, 'Could not export the statistics: Network Error')).toBeVisible();
    });

    test('an unknown event goes back to the list of statutory events', async ({ page, api }) => {
        api.fallback(mockEverything);
        api.on('GET statutory /events/:id', { status: 404, json: notFound('Event with such url or ID is not found.') });

        await page.goto('/statutory/nope/plenaries');

        await expect(toast(page, 'Event is not found')).toBeVisible();
        await expect(page).toHaveURL('/statutory');
    });

    test('who may not see the plenaries goes back to the list of statutory events', async ({ page, api }) => {
        api.fallback(mockEverything);
        api.json('GET statutory /events/:id', ok(statutoryEvent({ id: 5, url: 'agora-spring' })));
        api.on('GET statutory /events/:id/plenaries', { status: 403, json: forbidden('You cannot manage plenaries.') });

        await page.goto('/statutory/agora-spring/plenaries');

        await expect(toast(page, 'Some error happened: You cannot manage plenaries.')).toBeVisible();
        await expect(page).toHaveURL('/statutory');
    });

    test('an event that is not an Agora has no plenaries', async ({ page, api }) => {
        api.fallback(mockEverything);
        api.json('GET statutory /events/:id', ok(statutoryEvent({ id: 6, url: 'epm-spring', type: 'epm', permissions: CHAIR })));
        api.on('GET statutory /events/:id/plenaries', { status: 400, json: { success: false, message: 'You can only access memberslist for Agora.' } });

        await page.goto('/statutory/epm-spring/plenaries');

        await expect(toast(page, 'Some error happened: You can only access memberslist for Agora.')).toBeVisible();
        await expect(page).toHaveURL('/statutory');
    });
});
