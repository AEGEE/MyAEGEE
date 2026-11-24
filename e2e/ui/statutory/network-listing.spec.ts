// The network director's page of a statutory event (/statutory/:id/network): every application
// that isn't cancelled, and whether its applicant is on the members list of their body.
import type { Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { forbidden, notFound, ok, okList } from '../support/factories/base.ts';
import { networkApplication, type NetworkApplication } from '../support/factories/statutory-applications.ts';
import { cellOf, expectEmptyTable, sortBy, tableRows, toast } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { test, expect } from '../support/test.ts';

const ALEX = networkApplication({ id: 12, statutory_id: '001-0001', user_id: 2, first_name: 'Alex', last_name: 'Member', body_name: 'AEGEE-Antenna' });
const JAN = networkApplication({
    id: 13,
    statutory_id: '001-0002',
    user_id: 7,
    first_name: 'Jan',
    last_name: 'Jansen',
    body_id: 3,
    body_name: 'AEGEE-Utrecht',
    participant_type: 'visitor',
    participant_order: 4,
    is_on_memberslist: true
});

type List = (query: URLSearchParams) => ReturnType<typeof okList<NetworkApplication>>;

const mockList = (api: ApiMock, list: List = () => okList([ALEX, JAN])) => {
    api.on('GET statutory /events/:id/applications/network', ({ query }) => ({ json: list(query) }));
};

const listCalls = (api: ApiMock) => api.callsTo('GET statutory /events/:id/applications/network');
const participants = (page: Page) => page.getByRole('region', { name: 'Participants' }).getByRole('table');
const rowOf = (page: Page, name: string) => tableRows(participants(page)).filter({ hasText: name });
const status = (page: Page, name: string) => page.getByRole('combobox', { name: `Members list status of ${name}` });

test.describe('the network director\'s page', () => {
    test('shows the applicants and whether they are on their body\'s members list', async ({ page, api }) => {
        mockList(api);
        await page.goto('/statutory/agora-spring/network');

        await expect(page.getByRole('heading', { name: 'Network Director listing' })).toBeVisible();
        await expect(page).toHaveTitle('MyAEGEE | Set members list status for participants');
        await expect(page.getByText('Total participants: 2')).toBeVisible();

        const table = participants(page);
        const alex = rowOf(page, 'Alex');
        await expect(await cellOf(table, alex, '#')).toHaveText('001-0001');
        await expect(await cellOf(table, alex, 'User ID')).toHaveText('2');
        await expect(await cellOf(table, alex, 'First name')).toHaveText('Alex');
        await expect(await cellOf(table, alex, 'Last name')).toHaveText('Member');
        await expect(await cellOf(table, alex, 'Body')).toHaveText('AEGEE-Antenna');
        await expect(await cellOf(table, alex, 'Participant type')).toHaveText('Delegate');
        await expect(await cellOf(table, alex, 'Is on memberslist?')).toHaveText('No');
        await expect(status(page, 'Alex Member')).toHaveValue(/false/);

        const jan = rowOf(page, 'Jan');
        await expect(await cellOf(table, jan, 'Participant type')).toHaveText('Visitor');
        await expect(await cellOf(table, jan, 'Is on memberslist?')).toHaveText('Yes');
        await expect(status(page, 'Jan Jansen')).toHaveValue(/true/);

        expect(listCalls(api).map((call) => call.params)).toEqual([{ id: 'agora-spring' }]);
        expect(Object.fromEntries(listCalls(api)[0].query)).toEqual({ limit: '50', offset: '0', 'sort[field]': 'id', 'sort[order]': 'desc' });
    });

    test('an applicant without a place has an empty participant type', async ({ page, api }) => {
        mockList(api, () => okList([{ ...ALEX, participant_type: null, participant_order: null }]));
        await page.goto('/statutory/agora-spring/network');

        await expect(await cellOf(participants(page), rowOf(page, 'Alex'), 'Participant type')).toHaveText('');
    });

    test('putting an applicant on the members list saves it', async ({ page, api }) => {
        mockList(api);
        api.json('PUT statutory /events/:id/applications/:application_id/is_on_memberslist', ok({ ...ALEX, is_on_memberslist: true }));
        await page.goto('/statutory/agora-spring/network');

        await status(page, 'Alex Member').selectOption('Is on memberslist');

        await expect(toast(page, 'Successfully updated memberslist status of application for application #12')).toBeVisible();
        expect(api.callsTo('PUT statutory /events/:id/applications/:application_id/is_on_memberslist').map((call) => [call.params, call.body]))
            .toEqual([[{ id: 'agora-spring', application_id: '12' }, { is_on_memberslist: true }]]);
        await expect(await cellOf(participants(page), rowOf(page, 'Alex'), 'Is on memberslist?')).toHaveText('Yes');
    });

    test('taking an applicant off the members list saves it', async ({ page, api }) => {
        mockList(api);
        api.json('PUT statutory /events/:id/applications/:application_id/is_on_memberslist', ok({ ...JAN, is_on_memberslist: false }));
        await page.goto('/statutory/agora-spring/network');

        await status(page, 'Jan Jansen').selectOption('Is not on memberslist');

        await expect(toast(page, 'Successfully updated memberslist status of application for application #13')).toBeVisible();
        expect(api.callsTo('PUT statutory /events/:id/applications/:application_id/is_on_memberslist').map((call) => call.body))
            .toEqual([{ is_on_memberslist: false }]);
        await expect(await cellOf(participants(page), rowOf(page, 'Jan'), 'Is on memberslist?')).toHaveText('No');
    });

    test('a refused change is shown, and the select goes back to what is stored', async ({ page, api }) => {
        mockList(api);
        api.on('PUT statutory /events/:id/applications/:application_id/is_on_memberslist', { status: 403, json: forbidden('You don\'t have permissions to change the "is_on_memberslist" attribute of this application.') });
        await page.goto('/statutory/agora-spring/network');

        await status(page, 'Alex Member').selectOption('Is on memberslist');

        await expect(toast(page, 'Could not update participant memberslist info: You don\'t have permissions to change the "is_on_memberslist" attribute of this application.')).toBeVisible();
        await expect(status(page, 'Alex Member')).toHaveValue(/false/);
        await expect(await cellOf(participants(page), rowOf(page, 'Alex'), 'Is on memberslist?')).toHaveText('No');
    });

    test('searching asks the service with the text, from the first page', async ({ page, api }) => {
        mockList(api, () => okList([ALEX, JAN], 60));
        await page.goto('/statutory/agora-spring/network');
        await page.getByRole('button', { name: 'Next page' }).click();
        await expect.poll(() => listCalls(api).length).toBe(2);
        expect(listCalls(api)[1].query.get('offset')).toBe('50');

        await page.getByRole('textbox', { name: 'Search by name, surname or statutory ID' }).fill('Jan');

        await expect.poll(() => listCalls(api).length).toBe(3);
        expect(listCalls(api)[2].query.get('query')).toBe('Jan');
        expect(listCalls(api)[2].query.get('offset')).toBe('0');
    });

    test('sorting by a column asks the service for that order', async ({ page, api, layout }) => {
        mockList(api);
        await page.goto('/statutory/agora-spring/network');
        await expect(tableRows(participants(page))).toHaveCount(2);

        // A column the table isn't sorted by yet is sorted newest first.
        await sortBy(participants(page), 'Is on memberslist?', layout);

        await expect.poll(() => listCalls(api).length).toBe(2);
        expect(listCalls(api)[1].query.get('sort[field]')).toBe('is_on_memberslist');
        expect(listCalls(api)[1].query.get('sort[order]')).toBe('desc');
    });

    test('the column of the status selects can\'t be sorted by', {
        tag: '@desktop-only',
        annotation: { type: 'desktop-only', description: 'the phone has the sort select instead of clickable headers (covered by the next test)' }
    }, async ({ page, api }) => {
        mockList(api);
        await page.goto('/statutory/agora-spring/network');
        const table = participants(page);

        // eslint-disable-next-line no-restricted-syntax -- clicking a header is what this desktop test is about
        await table.getByRole('columnheader', { name: 'Set memberslist status' }).click();
        // eslint-disable-next-line no-restricted-syntax -- clicking a header is what this desktop test is about
        await table.getByRole('columnheader', { name: 'Body' }).click();

        await expect.poll(() => listCalls(api).length).toBe(2);
        expect(listCalls(api).map((call) => call.query.get('sort[field]'))).toEqual(['id', 'body_name']);
    });

    test('the sort control doesn\'t offer the column of the status selects', { tag: '@phone-only' }, async ({ page, api }) => {
        mockList(api);
        await page.goto('/statutory/agora-spring/network');

        const sortControl = page.getByRole('combobox').filter({ has: page.getByRole('option', { name: 'User ID', exact: true }) });
        await expect(sortControl.getByRole('option', { name: 'Body', exact: true })).toHaveCount(1);
        await expect(sortControl.getByRole('option', { name: 'Set memberslist status', exact: true })).toHaveCount(0);
    });

    test('an event without applications says so', async ({ page, api }) => {
        mockList(api, () => okList([]));
        await page.goto('/statutory/agora-spring/network');

        await expect.poll(() => listCalls(api).length).toBe(1);
        await expectEmptyTable(participants(page));
        await expect(page.getByText('Total participants: 0')).toBeVisible();
    });

    test('the table says it is loading while the applicants come', async ({ page, api }) => {
        api.on('GET statutory /events/:id/applications/network', { json: okList([ALEX]), delayMs: 1000 });
        await page.goto('/statutory/agora-spring/network');

        await expect(page.getByRole('region', { name: 'Participants' })).toHaveAttribute('aria-busy', 'true');
        await expect(page.getByRole('region', { name: 'Participants' })).toHaveAttribute('aria-busy', 'false');
        await expect(tableRows(participants(page))).toHaveCount(1);
    });

    test('an unknown event goes back to the list of statutory events', async ({ page, api }) => {
        api.fallback(mockEverything);
        api.on('GET statutory /events/:id/applications/network', { status: 404, json: notFound('Event with such url or ID is not found.') });
        await page.goto('/statutory/nope/network');

        await expect(toast(page, 'Event is not found')).toBeVisible();
        await expect(page).toHaveURL('/statutory');
    });

    test('someone who may not see the applicants goes back to the list of statutory events', async ({ page, api }) => {
        api.fallback(mockEverything);
        api.on('GET statutory /events/:id/applications/network', { status: 403, json: forbidden('You are not allowed to see applications.') });
        await page.goto('/statutory/agora-spring/network');

        await expect(toast(page, 'Some error happened: You are not allowed to see applications.')).toBeVisible();
        await expect(page).toHaveURL('/statutory');
    });
});
