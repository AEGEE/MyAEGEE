// The juridical commission's page of a statutory event (/statutory/:id/juridical): the
// accepted participants who paid, whether each registered with the JC and departed, and the
// export of the delegates for the JC's own tool.
import fs from 'node:fs';

import type { Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { forbidden, notFound, ok, okList, validationError } from '../support/factories/base.ts';
import { juridicalApplication, type JuridicalApplication } from '../support/factories/statutory-applications.ts';
import { statutoryEvent, statutoryEventPermissions, type StatutoryEvent } from '../support/factories/statutory-events.ts';
import { cellOf, expectEmptyTable, freezeTime, sortBy, tableRows, toast } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { test, expect } from '../support/test.ts';

// The juridical commission (global:manage_juridical:agora).
const JURIDICAL = statutoryEventPermissions({
    manage_juridical: true,
    see_applications_juridical: true,
    export: { openslides: false, all: false, incoming: false, delegates_jc: true }
});
const EVENT = statutoryEvent({ url: 'agora-spring', permissions: JURIDICAL });

const ALEX = juridicalApplication({ id: 12, statutory_id: '001-0001', user_id: 2, first_name: 'Alex', last_name: 'Member', body_name: 'AEGEE-Antenna' });
const JAN = juridicalApplication({
    id: 13,
    statutory_id: '001-0002',
    user_id: 7,
    first_name: 'Jan',
    last_name: 'Jansen',
    body_id: 3,
    body_name: 'AEGEE-Utrecht',
    participant_type: 'envoy',
    participant_order: 2,
    registered: true
});

type List = (query: URLSearchParams) => ReturnType<typeof okList<JuridicalApplication>>;

const mockPage = (api: ApiMock, list: List = () => okList([ALEX, JAN]), event: StatutoryEvent = EVENT) => {
    api.json('GET statutory /events/:id', ok(event));
    api.on('GET statutory /events/:id/applications/juridical', ({ query }) => ({ json: list(query) }));
};

const listCalls = (api: ApiMock) => api.callsTo('GET statutory /events/:id/applications/juridical');
const participants = (page: Page) => page.getByRole('region', { name: 'Participants' }).getByRole('table');
const rowOf = (page: Page, name: string) => tableRows(participants(page)).filter({ hasText: name });
const select = (page: Page, column: 'JC registered' | 'Departed', name: string) => page.getByRole('combobox', { name: `${column} of ${name}` });
const exportButton = (page: Page) => page.getByRole('button', { name: 'Export all delegates for OMS JC' });

test.describe('the juridical commission\'s page', () => {
    test('shows the participants who paid, with their place and registration', async ({ page, api }) => {
        mockPage(api);
        await page.goto('/statutory/agora-spring/juridical');

        await expect(page.getByRole('heading', { name: 'JC listing form' })).toBeVisible();
        await expect(page).toHaveTitle('MyAEGEE | Manage juridical info for the statutory event');
        await expect(page.getByText('Total participants: 2')).toBeVisible();

        const table = participants(page);
        const alex = rowOf(page, 'Alex');
        await expect(await cellOf(table, alex, '#')).toHaveText('001-0001');
        await expect(await cellOf(table, alex, 'User ID')).toHaveText('2');
        await expect(await cellOf(table, alex, 'First name')).toHaveText('Alex');
        await expect(await cellOf(table, alex, 'Last name')).toHaveText('Member');
        await expect(await cellOf(table, alex, 'Body')).toHaveText('AEGEE-Antenna');
        await expect(await cellOf(table, alex, 'Participant type and order')).toHaveText('delegate (1)');
        await expect(await cellOf(table, alex, 'Confirmed')).toHaveText('Yes');
        await expect(await cellOf(table, rowOf(page, 'Jan'), 'Participant type and order')).toHaveText('envoy (2)');

        await expect(select(page, 'JC registered', 'Alex Member')).toHaveValue(/false/);
        await expect(select(page, 'JC registered', 'Alex Member')).toBeEnabled();
        // Who didn't register can't have departed.
        await expect(select(page, 'Departed', 'Alex Member')).toBeDisabled();
        await expect(select(page, 'JC registered', 'Jan Jansen')).toHaveValue(/true/);
        await expect(select(page, 'Departed', 'Jan Jansen')).toBeEnabled();

        expect(Object.fromEntries(listCalls(api)[0].query)).toEqual({ limit: '50', offset: '0', 'sort[field]': 'id', 'sort[order]': 'desc' });
        expect(api.callsTo('GET statutory /events/:id').map((call) => call.params)).toEqual([{ id: 'agora-spring' }]);
    });

    test('a participant without a place has an empty place', async ({ page, api }) => {
        mockPage(api, () => okList([{ ...ALEX, participant_type: null, participant_order: null }]));
        await page.goto('/statutory/agora-spring/juridical');

        await expect(await cellOf(participants(page), rowOf(page, 'Alex'), 'Participant type and order')).toHaveText('');
    });

    test('registering a participant lets them be marked as departed', async ({ page, api }) => {
        mockPage(api);
        api.json('PUT statutory /events/:id/applications/:application_id/registered', ok({ ...ALEX, registered: true }));
        await page.goto('/statutory/agora-spring/juridical');

        await select(page, 'JC registered', 'Alex Member').selectOption('Yes');

        await expect(toast(page, 'Successfully updated registration info of application for user #2')).toBeVisible();
        expect(api.callsTo('PUT statutory /events/:id/applications/:application_id/registered').map((call) => [call.params, call.body]))
            .toEqual([[{ id: 'agora-spring', application_id: '12' }, { registered: true }]]);
        await expect(select(page, 'Departed', 'Alex Member')).toBeEnabled();
    });

    test('a participant who departed can\'t be unregistered', async ({ page, api }) => {
        mockPage(api);
        api.json('PUT statutory /events/:id/applications/:application_id/departed', ok({ ...JAN, departed: true }));
        await page.goto('/statutory/agora-spring/juridical');

        await select(page, 'Departed', 'Jan Jansen').selectOption('Yes');

        await expect(toast(page, 'Successfully updated departure info of application for user #7')).toBeVisible();
        expect(api.callsTo('PUT statutory /events/:id/applications/:application_id/departed').map((call) => [call.params.application_id, call.body]))
            .toEqual([['13', { departed: true }]]);
        await expect(select(page, 'JC registered', 'Jan Jansen')).toBeDisabled();
    });

    test('a refused change is shown, and the select goes back to what is stored', async ({ page, api }) => {
        mockPage(api);
        api.on('PUT statutory /events/:id/applications/:application_id/registered', { status: 403, json: forbidden('You don\'t have permissions to change the "registered" attribute of this application.') });
        api.on('PUT statutory /events/:id/applications/:application_id/departed', { status: 422, json: validationError({ departed: ['You should set user as registered first.'] }) });
        await page.goto('/statutory/agora-spring/juridical');

        await select(page, 'JC registered', 'Alex Member').selectOption('Yes');
        await expect(toast(page, 'Could not update participant registration info: You don\'t have permissions to change the "registered" attribute of this application.')).toBeVisible();
        await expect(select(page, 'JC registered', 'Alex Member')).toHaveValue(/false/);
        await expect(select(page, 'Departed', 'Alex Member')).toBeDisabled();

        await select(page, 'Departed', 'Jan Jansen').selectOption('Yes');
        await expect(toast(page, /^Could not update participant departure info: /)).toBeVisible();
        await expect(select(page, 'Departed', 'Jan Jansen')).toHaveValue(/false/);
        await expect(select(page, 'JC registered', 'Jan Jansen')).toBeEnabled();
    });

    test('the delegates are exported for the JC\'s tool', async ({ page, api }) => {
        await freezeTime(page);
        mockPage(api);
        const csv = '001-0001;member2@example.com;Alex;Member;ANT;delegate\n';
        api.on('GET statutory /events/:id/applications/export/delegates_jc', { body: csv, contentType: 'text/csv' });
        await page.goto('/statutory/agora-spring/juridical');
        await expect(tableRows(participants(page))).toHaveCount(2);
        const links = await page.getByRole('link').count();

        const download = page.waitForEvent('download');
        await exportButton(page).click();

        // Named after the moment of the export (Chromium may write the colons differently).
        const file = await download;
        expect(file.suggestedFilename()).toMatch(/^delegates_jc_2027-03-01T09.00.\d\d\.\d{3}Z\.csv$/);
        expect(fs.readFileSync(await file.path(), 'utf8')).toBe(csv);
        expect(api.callsTo('GET statutory /events/:id/applications/export/delegates_jc').map((call) => call.params)).toEqual([{ id: 'agora-spring' }]);
        // The link the file came through is gone again.
        await expect(page.getByRole('link')).toHaveCount(links);
    });

    test('a refused export says why', async ({ page, api }) => {
        mockPage(api);
        api.on('GET statutory /events/:id/applications/export/delegates_jc', { status: 403, json: forbidden('You are not allowed to export delegates for JC.') });
        await page.goto('/statutory/agora-spring/juridical');

        await exportButton(page).click();

        await expect(toast(page, 'Could not export the delegates: You are not allowed to export delegates for JC.')).toBeVisible();
    });

    test('an export that fails without a message from the service says so', async ({ page, api }) => {
        mockPage(api);
        api.on('GET statutory /events/:id/applications/export/delegates_jc', { status: 502, body: '<html>Bad gateway</html>', contentType: 'text/html' });
        await page.goto('/statutory/agora-spring/juridical');

        await exportButton(page).click();

        await expect(toast(page, 'Could not export the delegates: Request failed with status code 502')).toBeVisible();
    });

    test('an export that doesn\'t reach the service says so', async ({ page, api }) => {
        mockPage(api);
        api.on('GET statutory /events/:id/applications/export/delegates_jc', { abort: 'failed' });
        await page.goto('/statutory/agora-spring/juridical');

        await exportButton(page).click();

        await expect(toast(page, 'Could not export the delegates: Network Error')).toBeVisible();
    });

    test('the votes of an Agora are one click away', async ({ page, api }) => {
        mockPage(api);
        await page.goto('/statutory/agora-spring/juridical');

        await expect(page.getByRole('link', { name: 'View amount of votes' })).toHaveAttribute('href', '/statutory/agora-spring/votes');
    });

    test('an EPM has no votes to link to', async ({ page, api }) => {
        mockPage(api, undefined, statutoryEvent({ type: 'epm', url: 'epm-spring', permissions: JURIDICAL }));
        await page.goto('/statutory/epm-spring/juridical');

        await expect(tableRows(participants(page))).toHaveCount(2);
        await expect(exportButton(page)).toBeVisible();
        await expect(page.getByRole('link', { name: 'View amount of votes' })).toHaveCount(0);
    });

    test('searching asks the service with the text, from the first page', async ({ page, api }) => {
        mockPage(api, () => okList([ALEX, JAN], 60));
        await page.goto('/statutory/agora-spring/juridical');
        await page.getByRole('button', { name: 'Next page' }).click();
        await expect.poll(() => listCalls(api).length).toBe(2);
        expect(listCalls(api)[1].query.get('offset')).toBe('50');

        await page.getByRole('textbox', { name: 'Search by name, surname or statutory ID' }).fill('Jan');

        await expect.poll(() => listCalls(api).length).toBe(3);
        expect(listCalls(api)[2].query.get('query')).toBe('Jan');
        expect(listCalls(api)[2].query.get('offset')).toBe('0');
        // The event is the same for every search.
        expect(api.callsTo('GET statutory /events/:id')).toHaveLength(1);
    });

    test('sorting by a column asks the service for that order', async ({ page, api, layout }) => {
        mockPage(api);
        await page.goto('/statutory/agora-spring/juridical');
        await expect(tableRows(participants(page))).toHaveCount(2);

        // A column the table isn't sorted by yet is sorted newest first.
        await sortBy(participants(page), 'Last name', layout);

        await expect.poll(() => listCalls(api).length).toBe(2);
        expect(listCalls(api)[1].query.get('sort[field]')).toBe('last_name');
        expect(listCalls(api)[1].query.get('sort[order]')).toBe('desc');
        expect(listCalls(api)[1].query.get('offset')).toBe('0');
    });

    test('an event without registrable participants says so', async ({ page, api }) => {
        mockPage(api, () => okList([]));
        await page.goto('/statutory/agora-spring/juridical');

        await expect.poll(() => listCalls(api).length).toBe(1);
        await expectEmptyTable(participants(page));
        await expect(page.getByText('Total participants: 0')).toBeVisible();
    });

    test('the table says it is loading while the participants come', async ({ page, api }) => {
        api.json('GET statutory /events/:id', ok(EVENT));
        api.on('GET statutory /events/:id/applications/juridical', { json: okList([ALEX]), delayMs: 1000 });
        await page.goto('/statutory/agora-spring/juridical');

        await expect(page.getByRole('region', { name: 'Participants' })).toHaveAttribute('aria-busy', 'true');
        await expect(page.getByRole('region', { name: 'Participants' })).toHaveAttribute('aria-busy', 'false');
        await expect(tableRows(participants(page))).toHaveCount(1);
    });

    test('an unknown event goes back to the list of statutory events', async ({ page, api }) => {
        api.fallback(mockEverything);
        api.on('GET statutory /events/:id', { status: 404, json: notFound('Event with such url or ID is not found.') });
        await page.goto('/statutory/nope/juridical');

        await expect(toast(page, 'Event is not found')).toBeVisible();
        await expect(page).toHaveURL('/statutory');
    });

    test('someone who may not see the participants goes back to the list of statutory events', async ({ page, api }) => {
        api.fallback(mockEverything);
        api.json('GET statutory /events/:id', ok(statutoryEvent({ url: 'agora-spring' })));
        api.on('GET statutory /events/:id/applications/juridical', { status: 403, json: forbidden('You are not allowed to see applications.') });
        await page.goto('/statutory/agora-spring/juridical');

        await expect(toast(page, 'Some error happened: You are not allowed to see applications.')).toBeVisible();
        await expect(page).toHaveURL('/statutory');
    });
});
