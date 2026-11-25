// The export page of a statutory event (/statutory/:id/applications/export): the participants
// as a spreadsheet with the fields and filters the officer picks, and the import file of
// OpenSlides.
import fs from 'node:fs';

import type { Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { forbidden, notFound, ok } from '../support/factories/base.ts';
import {
    statutoryEvent,
    statutoryEventPermissions,
    statutoryManagerPermissions,
    type StatutoryEventPermissions
} from '../support/factories/statutory-events.ts';
import { applicationFields, incomingApplicationFields, type ApplicationFields } from '../support/factories/statutory-stats.ts';
import { freezeTime, toast } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { test, expect } from '../support/test.ts';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const SPREADSHEET = Buffer.from('PK\u0003\u0004 the participants');

// Who manages the applications (global:manage_applications:agora) may export everything.
const MANAGER = statutoryManagerPermissions();
// The incoming team (global:manage_incoming:agora) only what it needs, of accepted participants.
const INCOMING = statutoryEventPermissions({
    manage_incoming: true,
    see_applications_incoming: true,
    export: { openslides: true, all: false, incoming: true, delegates_jc: false }
});

const FIELDS = { first_name: 'First name', last_name: 'Last name', body_name: 'Body name', meals: 'Meals' };

const mockPage = (api: ApiMock, { permissions = MANAGER, fields = FIELDS, prefix = 'all' }: { permissions?: StatutoryEventPermissions; fields?: ApplicationFields; prefix?: 'all' | 'incoming' } = {}) => {
    api.json('GET statutory /events/:id', ok(statutoryEvent({ url: 'agora-spring', permissions })));
    api.json(`GET statutory /events/:id/fields/applications/${prefix}`, ok(fields));
};

const exportCalls = (api: ApiMock) => api.callsTo('GET statutory /events/:id/applications/export/:prefix');
const exportButton = (page: Page) => page.getByRole('button', { name: 'Export participants data' });
const openSlidesButton = (page: Page) => page.getByRole('button', { name: 'Export OpenSlides data' });

test.describe('the export page of a statutory event', () => {
    test('exports the chosen fields of the participants who match the filters', async ({ page, api }) => {
        await freezeTime(page);
        mockPage(api);
        api.on('GET statutory /events/:id/applications/export/:prefix', { body: SPREADSHEET, contentType: XLSX });
        await page.goto('/statutory/agora-spring/applications/export');

        await expect(page.getByRole('heading', { name: 'Export data for Agora Spring' })).toBeVisible();
        await expect(page).toHaveTitle('MyAEGEE | Export stats for statutory');
        // Every field is picked to begin with.
        for (const name of ['First name', 'Last name', 'Body name', 'Meals']) {
            await expect(page.getByRole('checkbox', { name })).toBeChecked();
        }

        await page.getByLabel('Filter on participant status').selectOption('Accepted participants');
        await page.getByLabel('Filter on cancellation').selectOption('Cancelled participants');
        await page.getByLabel('Filter on confirmation').selectOption('Not confirmed participants');
        await page.getByLabel('Filter on participant type').selectOption('Delegates');
        await page.getByRole('checkbox', { name: 'Body name' }).uncheck();

        const download = page.waitForEvent('download');
        await exportButton(page).click();

        // Named after the moment of the export (Chromium may write the colons differently).
        const file = await download;
        expect(file.suggestedFilename()).toMatch(/^participants_2027-03-01T09.00.\d\d\.\d{3}Z\.xlsx$/);
        expect(fs.readFileSync(await file.path())).toEqual(SPREADSHEET);

        expect(exportCalls(api).map((call) => [call.params, call.query.getAll('select[]'), Object.fromEntries([...call.query].filter(([key]) => key.startsWith('filter')))]))
            .toEqual([[
                { id: 'agora-spring', prefix: 'all' },
                ['first_name', 'last_name', 'meals'],
                { 'filter[status]': 'accepted', 'filter[cancelled]': 'true', 'filter[confirmed]': 'false', 'filter[participant_type]': 'delegate' }
            ]]);
        expect(api.callsTo('GET statutory /events/:id/fields/applications/all').map((call) => call.params)).toEqual([{ id: 'agora-spring' }]);
    });

    test('without filters the export has the participants who didn\'t cancel', async ({ page, api }) => {
        mockPage(api);
        api.on('GET statutory /events/:id/applications/export/:prefix', { body: SPREADSHEET, contentType: XLSX });
        await page.goto('/statutory/agora-spring/applications/export');

        // statutory leaves out the cancelled applications unless asked for them.
        await expect(page.getByLabel('Filter on cancellation').getByRole('option', { name: 'Not cancelled (default)', selected: true })).toHaveCount(1);
        await expect(page.getByLabel('Filter on participant status').getByRole('option', { name: 'Everybody', selected: true })).toHaveCount(1);
        await expect(page.getByLabel('Filter on confirmation').getByRole('option', { name: 'Everybody', selected: true })).toHaveCount(1);
        await expect(page.getByLabel('Filter on participant type').getByRole('option', { name: 'Everybody', selected: true })).toHaveCount(1);

        const download = page.waitForEvent('download');
        await exportButton(page).click();
        await download;

        expect(exportCalls(api).map((call) => [...call.query.keys()])).toEqual([['select[]', 'select[]', 'select[]', 'select[]']]);
    });

    test('the link the file came through is gone again', async ({ page, api }) => {
        mockPage(api);
        api.on('GET statutory /events/:id/applications/export/:prefix', { body: SPREADSHEET, contentType: XLSX });
        await page.goto('/statutory/agora-spring/applications/export');
        await expect(page.getByRole('checkbox', { name: 'Meals' })).toBeChecked();
        const links = await page.getByRole('link').count();

        const download = page.waitForEvent('download');
        await exportButton(page).click();
        await download;

        await expect(page.getByRole('link')).toHaveCount(links);
    });

    test('the answers to the event\'s questions can be exported too', async ({ page, api }) => {
        mockPage(api, { fields: applicationFields([{ description: 'Why do you want to go?' }, { description: 'Your motto?' }]) });
        await page.goto('/statutory/agora-spring/applications/export');

        await expect(page.getByRole('checkbox', { name: 'Answer 1: Why do you want to go?' })).toBeChecked();
        await expect(page.getByRole('checkbox', { name: 'Answer 2: Your motto?' })).toBeChecked();
        await expect(page.getByRole('checkbox', { name: 'Board comment' })).toBeChecked();
        await expect(page.getByRole('checkbox')).toHaveCount(Object.keys(applicationFields()).length + 1);
    });

    test('nothing can be exported without a field', async ({ page, api }) => {
        mockPage(api, { fields: { first_name: 'First name', last_name: 'Last name' } });
        await page.goto('/statutory/agora-spring/applications/export');

        await page.getByRole('checkbox', { name: 'First name' }).uncheck();
        await expect(exportButton(page)).toBeEnabled();
        await page.getByRole('checkbox', { name: 'Last name' }).uncheck();

        await expect(exportButton(page)).toBeDisabled();
        await page.getByRole('checkbox', { name: 'Last name' }).check();
        await expect(exportButton(page)).toBeEnabled();
    });

    test('an event without fields to export offers none', async ({ page, api }) => {
        mockPage(api, { fields: {} });
        await page.goto('/statutory/agora-spring/applications/export');

        await expect.poll(() => api.callsTo('GET statutory /events/:id/fields/applications/all').length).toBe(1);
        await expect(page.getByRole('checkbox')).toHaveCount(0);
        await expect(exportButton(page)).toBeDisabled();
    });

    test('a refused export says why', async ({ page, api }) => {
        mockPage(api);
        api.on('GET statutory /events/:id/applications/export/:prefix', { status: 403, json: forbidden('You are not allowed to export participants.') });
        await page.goto('/statutory/agora-spring/applications/export');

        await exportButton(page).click();

        await expect(toast(page, 'Could not export the participants: You are not allowed to export participants.')).toBeVisible();
    });

    test('an export that fails without a message from the service says so', async ({ page, api }) => {
        mockPage(api);
        api.on('GET statutory /events/:id/applications/export/:prefix', { status: 502, body: '<html>Bad gateway</html>', contentType: 'text/html' });
        await page.goto('/statutory/agora-spring/applications/export');

        await exportButton(page).click();

        await expect(toast(page, 'Could not export the participants: Request failed with status code 502')).toBeVisible();
    });

    test('an export that doesn\'t reach the service says so', async ({ page, api }) => {
        mockPage(api);
        api.on('GET statutory /events/:id/applications/export/:prefix', { abort: 'failed' });
        await page.goto('/statutory/agora-spring/applications/export');

        await exportButton(page).click();

        await expect(toast(page, 'Could not export the participants: Network Error')).toBeVisible();
    });

    test('the OpenSlides import file is downloaded', async ({ page, api }) => {
        await freezeTime(page);
        mockPage(api);
        const csv = '"Title","Given name","Surname"\n"","Alex","Member"';
        api.on('GET statutory /events/:id/applications/export/openslides', { body: csv, contentType: 'text/csv' });
        await page.goto('/statutory/agora-spring/applications/export');

        await expect(page.getByText('Keep in mind that the passwords for OpenSlides are generated at the runtime.')).toBeVisible();
        const links = await page.getByRole('link').count();
        const download = page.waitForEvent('download');
        await openSlidesButton(page).click();

        const file = await download;
        expect(file.suggestedFilename()).toMatch(/^openslides_2027-03-01T09.00.\d\d\.\d{3}Z\.csv$/);
        expect(fs.readFileSync(await file.path(), 'utf8')).toBe(csv);
        expect(api.callsTo('GET statutory /events/:id/applications/export/openslides').map((call) => call.params)).toEqual([{ id: 'agora-spring' }]);
        await expect(page.getByRole('link')).toHaveCount(links);
    });

    test('a refused OpenSlides export says why', async ({ page, api }) => {
        mockPage(api);
        api.on('GET statutory /events/:id/applications/export/openslides', { status: 403, json: forbidden('You are not allowed to see statistics.') });
        await page.goto('/statutory/agora-spring/applications/export');

        await openSlidesButton(page).click();

        await expect(toast(page, 'Could not export the OpenSlides data: You are not allowed to see statistics.')).toBeVisible();
    });

    test('the incoming team exports its own fields of the accepted participants', async ({ page, api }) => {
        mockPage(api, { permissions: INCOMING, fields: incomingApplicationFields(), prefix: 'incoming' });
        api.on('GET statutory /events/:id/applications/export/:prefix', { body: SPREADSHEET, contentType: XLSX });
        await page.goto('/statutory/agora-spring/applications/export');

        await expect(page.getByRole('checkbox', { name: 'Allergies' })).toBeChecked();
        await expect(page.getByRole('checkbox')).toHaveCount(Object.keys(incomingApplicationFields()).length);
        await expect(page.getByRole('checkbox', { name: 'Board comment' })).toHaveCount(0);
        // statutory exports only accepted participants for them, so there is nothing to filter.
        await expect(page.getByLabel('Filter on participant status')).toHaveCount(0);
        await expect(page.getByLabel('Filter on cancellation')).toHaveCount(0);
        await expect(page.getByLabel('Filter on confirmation')).toHaveCount(0);
        await expect(page.getByLabel('Filter on participant type')).toHaveCount(0);
        await expect(openSlidesButton(page)).toBeVisible();

        const download = page.waitForEvent('download');
        await exportButton(page).click();
        await download;

        expect(exportCalls(api).map((call) => [call.params.prefix, call.query.getAll('select[]').length, call.query.has('filter[status]')]))
            .toEqual([['incoming', Object.keys(incomingApplicationFields()).length, false]]);
    });

    test('who may not export for OpenSlides doesn\'t get its button', async ({ page, api }) => {
        mockPage(api, { permissions: statutoryEventPermissions({ export: { openslides: false, all: true, incoming: true, delegates_jc: false } }) });
        await page.goto('/statutory/agora-spring/applications/export');

        await expect(page.getByRole('checkbox', { name: 'Meals' })).toBeChecked();
        await expect(page.getByLabel('Filter on participant status')).toBeVisible();
        await expect(openSlidesButton(page)).toHaveCount(0);
        await expect(page.getByText('Keep in mind that the passwords for OpenSlides')).toHaveCount(0);
    });

    test('an unknown event goes back to the list of statutory events', async ({ page, api }) => {
        api.fallback(mockEverything);
        api.on('GET statutory /events/:id', { status: 404, json: notFound('Event with such url or ID is not found.') });
        await page.goto('/statutory/nope/applications/export');

        await expect(toast(page, 'Event is not found')).toBeVisible();
        await expect(page).toHaveURL('/statutory');
    });

    test('fields that can\'t be loaded send the officer back to the list of statutory events', async ({ page, api }) => {
        api.fallback(mockEverything);
        api.json('GET statutory /events/:id', ok(statutoryEvent({ url: 'agora-spring', permissions: MANAGER })));
        api.on('GET statutory /events/:id/fields/applications/all', { status: 500, json: { success: false, message: 'Internal server error.' } });
        await page.goto('/statutory/agora-spring/applications/export');

        await expect(toast(page, 'Some error happened: Internal server error.')).toBeVisible();
        await expect(page).toHaveURL('/statutory');
    });
});
