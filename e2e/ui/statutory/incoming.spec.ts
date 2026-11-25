// The incoming team's page of a statutory event (/statutory/:id/incoming): the accepted
// participants, and whether each paid the fee, filled in the incoming form and attended.
import type { Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { forbidden, notFound, ok, okList, validationError } from '../support/factories/base.ts';
import { incomingApplication, type IncomingApplication } from '../support/factories/statutory-applications.ts';
import { statutoryEvent, statutoryEventPermissions } from '../support/factories/statutory-events.ts';
import { cellOf, expectEmptyTable, openMenu, sortBy, tableRows, toast } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { test, expect } from '../support/test.ts';

const EVENT = statutoryEvent({
    url: 'agora-spring',
    permissions: statutoryEventPermissions({ manage_incoming: true, see_applications_incoming: true, export: { openslides: true, all: false, incoming: true, delegates_jc: false } })
});

const ALEX = incomingApplication({
    id: 12,
    statutory_id: '001-0001',
    user_id: 2,
    first_name: 'Alex',
    last_name: 'Member',
    body_name: 'AEGEE-Antenna',
    meals: 'Vegan',
    allergies: 'Nuts',
    confirmed: false
});
const JAN = incomingApplication({
    id: 13,
    statutory_id: '001-0002',
    user_id: 7,
    first_name: 'Jan',
    last_name: 'Jansen',
    body_id: 3,
    body_name: 'AEGEE-Utrecht',
    meals: 'Meat-eater',
    allergies: '',
    confirmed: true,
    incoming: true
});

const mockPage = (api: ApiMock, list: (query: URLSearchParams) => ReturnType<typeof okList<IncomingApplication>> = () => okList([ALEX, JAN])) => {
    api.json('GET statutory /events/:id', ok(EVENT));
    api.on('GET statutory /events/:id/applications/incoming', ({ query }) => ({ json: list(query) }));
};

const listCalls = (api: ApiMock) => api.callsTo('GET statutory /events/:id/applications/incoming');
const participants = (page: Page) => page.getByRole('region', { name: 'Participants' }).getByRole('table');
const rowOf = (page: Page, name: string) => tableRows(participants(page)).filter({ hasText: name });
const select = (page: Page, column: 'Confirmed' | 'Incoming form filled' | 'Attended', name: string) => page.getByRole('combobox', { name: `${column} of ${name}` });

test.describe('the incoming team\'s page', () => {
    test('shows the accepted participants with what the incoming team needs', async ({ page, api }) => {
        mockPage(api);
        await page.goto('/statutory/agora-spring/incoming');

        await expect(page.getByRole('heading', { name: 'Incoming', exact: true })).toBeVisible();
        await expect(page).toHaveTitle('MyAEGEE | Manage incoming info for the statutory event');
        await expect(page.getByText('Total participants: 2')).toBeVisible();

        const table = participants(page);
        const alex = rowOf(page, 'Alex');
        await expect(await cellOf(table, alex, '#')).toHaveText('001-0001');
        await expect(await cellOf(table, alex, 'User ID')).toHaveText('2');
        await expect(await cellOf(table, alex, 'First name')).toHaveText('Alex');
        await expect(await cellOf(table, alex, 'Last name')).toHaveText('Member');
        await expect(await cellOf(table, alex, 'Email')).toHaveText('member2@example.com');
        await expect(await cellOf(table, alex, 'Body')).toHaveText('AEGEE-Antenna');
        await expect(await cellOf(table, alex, 'Meals')).toHaveText('Vegan');
        await expect(await cellOf(table, alex, 'Allergies')).toHaveText('Nuts');
        await expect((await cellOf(table, alex, 'View')).getByRole('link', { name: 'View' })).toHaveAttribute('href', '/statutory/agora-spring/applications/001-0001');

        await expect(select(page, 'Confirmed', 'Alex Member')).toHaveValue(/false/);
        await expect(select(page, 'Confirmed', 'Alex Member')).toBeEnabled();
        // Who hasn't paid can't have attended.
        await expect(select(page, 'Attended', 'Alex Member')).toBeDisabled();
        await expect(select(page, 'Attended', 'Jan Jansen')).toBeEnabled();
        await expect(select(page, 'Incoming form filled', 'Jan Jansen')).toHaveValue(/true/);

        expect(Object.fromEntries(listCalls(api)[0].query)).toEqual({ limit: '50', offset: '0', 'sort[field]': 'id', 'sort[order]': 'desc' });
    });

    test('marking a participant as paid lets them be marked as attended', async ({ page, api }) => {
        mockPage(api);
        api.json('PUT statutory /events/:id/applications/:application_id/confirmed', ok({ ...ALEX, confirmed: true }));
        await page.goto('/statutory/agora-spring/incoming');

        await select(page, 'Confirmed', 'Alex Member').selectOption('Yes');

        await expect(toast(page, 'Successfully updated fee info of application for user #2')).toBeVisible();
        expect(api.callsTo('PUT statutory /events/:id/applications/:application_id/confirmed').map((call) => [call.params.application_id, call.body]))
            .toEqual([['12', { confirmed: true }]]);
        await expect(select(page, 'Attended', 'Alex Member')).toBeEnabled();
    });

    test('marking the incoming form as filled saves it', async ({ page, api }) => {
        mockPage(api);
        api.json('PUT statutory /events/:id/applications/:application_id/incoming', ok({ ...ALEX, incoming: true }));
        await page.goto('/statutory/agora-spring/incoming');

        await select(page, 'Incoming form filled', 'Alex Member').selectOption('Yes');

        await expect(toast(page, 'Successfully updated incoming info of application for user #2')).toBeVisible();
        expect(api.callsTo('PUT statutory /events/:id/applications/:application_id/incoming').map((call) => [call.params.application_id, call.body]))
            .toEqual([['12', { incoming: true }]]);
    });

    test('a participant who attended can\'t be changed back to not paid', async ({ page, api }) => {
        mockPage(api);
        api.json('PUT statutory /events/:id/applications/:application_id/attended', ok({ ...JAN, attended: true }));
        await page.goto('/statutory/agora-spring/incoming');

        await select(page, 'Attended', 'Jan Jansen').selectOption('Yes');

        await expect(toast(page, 'Successfully updated attendance info of application for user #7')).toBeVisible();
        expect(api.callsTo('PUT statutory /events/:id/applications/:application_id/attended').map((call) => [call.params.application_id, call.body]))
            .toEqual([['13', { attended: true }]]);
        await expect(select(page, 'Confirmed', 'Jan Jansen')).toBeDisabled();
        await expect(select(page, 'Incoming form filled', 'Jan Jansen')).toBeDisabled();
    });

    test('a refused change is shown, and the select goes back to what is stored', async ({ page, api }) => {
        mockPage(api);
        api.on('PUT statutory /events/:id/applications/:application_id/attended', { status: 422, json: validationError({ attended: ['You should set user as confirmed first.'] }) });
        api.on('PUT statutory /events/:id/applications/:application_id/confirmed', { status: 403, json: forbidden('You don\'t have permissions to change the "confirmed" attribute of this application.') });
        api.on('PUT statutory /events/:id/applications/:application_id/incoming', { status: 500, json: { success: false, message: 'Internal server error.' } });
        await page.goto('/statutory/agora-spring/incoming');

        await select(page, 'Attended', 'Jan Jansen').selectOption('Yes');
        await expect(toast(page, 'Could not update participant attendance info: You should set user as confirmed first.')).toBeVisible();
        await expect(select(page, 'Attended', 'Jan Jansen')).toHaveValue(/false/);

        await select(page, 'Confirmed', 'Alex Member').selectOption('Yes');
        await expect(toast(page, 'Could not update participant fee info: You don\'t have permissions to change the "confirmed" attribute of this application.')).toBeVisible();
        await expect(select(page, 'Confirmed', 'Alex Member')).toHaveValue(/false/);
        await expect(select(page, 'Attended', 'Alex Member')).toBeDisabled();

        await select(page, 'Incoming form filled', 'Alex Member').selectOption('Yes');
        await expect(toast(page, 'Could not update participant incoming info: Internal server error.')).toBeVisible();
        await expect(select(page, 'Incoming form filled', 'Alex Member')).toHaveValue(/false/);
    });

    test('searching asks the service with the text, from the first page', async ({ page, api }) => {
        mockPage(api, () => okList([ALEX, JAN], 60));
        await page.goto('/statutory/agora-spring/incoming');
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

    test('a late answer to an earlier search doesn\'t replace the answer to the last one', async ({ page, api }) => {
        mockPage(api);
        // The answer to "Ja" is held back until the one to "Jan" is shown.
        let release = (): void => undefined;
        const released = new Promise<void>((resolve) => { release = resolve; });
        api.on('GET statutory /events/:id/applications/incoming', async ({ query }) => {
            if (query.get('query') === 'Ja') {
                await released;
                return { json: okList([ALEX, JAN]) };
            }
            return { json: okList(query.get('query') === 'Jan' ? [JAN] : [ALEX, JAN]) };
        });
        const late = page.waitForResponse((response) => new URL(response.url()).searchParams.get('query') === 'Ja');
        await page.goto('/statutory/agora-spring/incoming');
        await expect(tableRows(participants(page))).toHaveCount(2);

        await page.getByRole('textbox', { name: 'Search by name, surname or statutory ID' }).fill('Ja');
        await page.getByRole('textbox', { name: 'Search by name, surname or statutory ID' }).fill('Jan');
        await expect(tableRows(participants(page))).toHaveCount(1);
        release();
        await (await late).finished();
        // Lets the page handle the answer it has just received (two turns of its event loop), so that what is checked below is after it
        await page.evaluate(() => new Promise((resolve) => { setTimeout(() => setTimeout(resolve, 0), 0); }));

        await expect(tableRows(participants(page))).toHaveText([/Jansen/]);
    });

    test('a late failure of an earlier search shows no error', async ({ page, api }) => {
        mockPage(api);
        let release = (): void => undefined;
        const released = new Promise<void>((resolve) => { release = resolve; });
        api.on('GET statutory /events/:id/applications/incoming', async ({ query }) => {
            if (query.get('query') === 'Ja') {
                await released;
                return { status: 500, json: { success: false, message: 'Internal server error.' } };
            }
            return { json: okList(query.get('query') === 'Jan' ? [JAN] : [ALEX, JAN]) };
        });
        const late = page.waitForResponse((response) => new URL(response.url()).searchParams.get('query') === 'Ja');
        await page.goto('/statutory/agora-spring/incoming');
        await expect(tableRows(participants(page))).toHaveCount(2);

        await page.getByRole('textbox', { name: 'Search by name, surname or statutory ID' }).fill('Ja');
        await page.getByRole('textbox', { name: 'Search by name, surname or statutory ID' }).fill('Jan');
        await expect(tableRows(participants(page))).toHaveCount(1);
        release();
        await (await late).finished();
        await page.evaluate(() => new Promise((resolve) => { setTimeout(() => setTimeout(resolve, 0), 0); }));

        // Counted at once: a toast goes away by itself, so waiting for none would always pass.
        expect(await toast(page, /Internal server error/).count()).toBe(0);
        await expect(page).toHaveURL('/statutory/agora-spring/incoming');
        await expect(tableRows(participants(page))).toHaveText([/Jansen/]);
    });

    test('a page left while its search runs shows no late error and stays left', async ({ page, api, layout }) => {
        api.fallback(mockEverything);
        mockPage(api);
        let release = (): void => undefined;
        const released = new Promise<void>((resolve) => { release = resolve; });
        api.on('GET statutory /events/:id/applications/incoming', async ({ query }) => {
            if (query.get('query') !== 'Ja') return { json: okList([ALEX, JAN]) };
            await released;
            return { status: 500, json: { success: false, message: 'Internal server error.' } };
        });
        const asked = page.waitForRequest((request) => new URL(request.url()).searchParams.get('query') === 'Ja');
        const late = page.waitForResponse((response) => new URL(response.url()).searchParams.get('query') === 'Ja');
        await page.goto('/statutory/agora-spring/incoming');
        await expect(tableRows(participants(page))).toHaveCount(2);
        await page.getByRole('textbox', { name: 'Search by name, surname or statutory ID' }).fill('Ja');
        await asked;

        await (await openMenu(page, layout)).getByRole('link', { name: 'Bodies', exact: true }).click();
        await expect(page).toHaveURL('/bodies');
        release();
        await (await late).finished();
        await page.evaluate(() => new Promise((resolve) => { setTimeout(() => setTimeout(resolve, 0), 0); }));

        expect(await toast(page, /Internal server error/).count()).toBe(0);
        await expect(page).toHaveURL('/bodies');
    });

    test('sorting by a column asks the service for that order', async ({ page, api, layout }) => {
        mockPage(api);
        await page.goto('/statutory/agora-spring/incoming');
        await expect(tableRows(participants(page))).toHaveCount(2);

        // A column the table isn't sorted by yet is sorted newest first.
        await sortBy(participants(page), 'First name', layout);

        await expect.poll(() => listCalls(api).length).toBe(2);
        expect(listCalls(api)[1].query.get('sort[field]')).toBe('first_name');
        expect(listCalls(api)[1].query.get('sort[order]')).toBe('desc');
    });

    test('the email can\'t be sorted by, as statutory doesn\'t have it', {
        tag: '@desktop-only',
        annotation: { type: 'desktop-only', description: 'the phone has the sort select instead of clickable headers (covered by the next test)' }
    }, async ({ page, api }) => {
        mockPage(api);
        await page.goto('/statutory/agora-spring/incoming');
        const table = participants(page);

        // eslint-disable-next-line no-restricted-syntax -- clicking a header is what this desktop test is about
        await table.getByRole('columnheader', { name: 'Email' }).click();
        // eslint-disable-next-line no-restricted-syntax -- clicking a header is what this desktop test is about
        await table.getByRole('columnheader', { name: 'Meals' }).click();

        await expect.poll(() => listCalls(api).length).toBe(2);
        expect(listCalls(api).map((call) => call.query.get('sort[field]'))).toEqual(['id', 'meals']);
    });

    test('the sort control doesn\'t offer the email', { tag: '@phone-only' }, async ({ page, api }) => {
        mockPage(api);
        await page.goto('/statutory/agora-spring/incoming');

        const sortControl = page.getByRole('combobox').filter({ has: page.getByRole('option', { name: 'User ID', exact: true }) });
        await expect(sortControl.getByRole('option', { name: 'Meals', exact: true })).toHaveCount(1);
        await expect(sortControl.getByRole('option', { name: 'Email', exact: true })).toHaveCount(0);
    });

    test('without a statutory ID the link uses the application\'s id', async ({ page, api }) => {
        mockPage(api, () => okList([{ ...JAN, statutory_id: null as unknown as string }]));
        await page.goto('/statutory/agora-spring/incoming');

        await expect((await cellOf(participants(page), rowOf(page, 'Jansen'), 'View')).getByRole('link', { name: 'View' }))
            .toHaveAttribute('href', '/statutory/agora-spring/applications/13');
    });

    test('an event without accepted participants says so', async ({ page, api }) => {
        mockPage(api, () => okList([]));
        await page.goto('/statutory/agora-spring/incoming');

        await expect.poll(() => listCalls(api).length).toBe(1);
        await expectEmptyTable(participants(page));
        await expect(page.getByText('Total participants: 0')).toBeVisible();
    });

    test('the table says it is loading while the participants come', async ({ page, api }) => {
        api.json('GET statutory /events/:id', ok(EVENT));
        api.on('GET statutory /events/:id/applications/incoming', { json: okList([ALEX]), delayMs: 1000 });
        await page.goto('/statutory/agora-spring/incoming');

        await expect(page.getByRole('region', { name: 'Participants' })).toHaveAttribute('aria-busy', 'true');
        await expect(page.getByRole('region', { name: 'Participants' })).toHaveAttribute('aria-busy', 'false');
        await expect(tableRows(participants(page))).toHaveCount(1);
    });

    test('an unknown event goes back to the list of statutory events', async ({ page, api }) => {
        api.fallback(mockEverything);
        api.on('GET statutory /events/:id', { status: 404, json: notFound('Event with such url or ID is not found.') });
        await page.goto('/statutory/nope/incoming');

        await expect(toast(page, 'Event is not found')).toBeVisible();
        await expect(page).toHaveURL('/statutory');
    });

    test('someone who may not see the participants goes back to the list of statutory events', async ({ page, api }) => {
        api.fallback(mockEverything);
        api.json('GET statutory /events/:id', ok(statutoryEvent({ url: 'agora-spring' })));
        api.on('GET statutory /events/:id/applications/incoming', { status: 403, json: forbidden('You are not allowed to see applications.') });
        await page.goto('/statutory/agora-spring/incoming');

        await expect(toast(page, 'Some error happened: You are not allowed to see applications.')).toBeVisible();
        await expect(page).toHaveURL('/statutory');
    });
});
