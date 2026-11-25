// Managing the applications to a statutory event (/statutory/:id/applications): the table of
// every application, its columns, the status of each, and searching, paging and sorting, which
// the service does.
import type { Locator, Page } from '@playwright/test';

import type { ApiMock, MockRequest } from '../support/api-mock.ts';
import { forbidden, notFound, ok, okList } from '../support/factories/base.ts';
import { listedApplication, type ListedApplication } from '../support/factories/statutory-applications.ts';
import { statutoryEvent, statutoryManagerPermissions, type StatutoryEvent } from '../support/factories/statutory-events.ts';
import { cellOf, expectEmptyTable, openMenu, sortBy, tableRows, toast } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { test, expect } from '../support/test.ts';

const QUESTIONS: StatutoryEvent['questions'] = [
    { type: 'string', description: 'Why do you want to go?', required: true },
    { type: 'checkbox', description: 'I need a visa', required: false }
];

const agora = (overrides: Partial<StatutoryEvent> = {}): StatutoryEvent => statutoryEvent({
    url: 'agora-spring', questions: QUESTIONS, permissions: statutoryManagerPermissions(), ...overrides
});

const ALEX = listedApplication({
    id: 12,
    statutory_id: '001-0001',
    user_id: 2,
    first_name: 'Alex',
    last_name: 'Member',
    body_name: 'AEGEE-Antenna',
    participant_type: 'delegate',
    participant_order: 1,
    board_comment: 'Active in the antenna',
    confirmed: true,
    is_on_memberslist: true,
    answers: ['To meet the network', true]
});
const JAN = listedApplication({
    id: 13,
    statutory_id: '001-0002',
    user_id: 7,
    first_name: 'Jan',
    last_name: 'Jansen',
    body_id: 3,
    body_name: 'AEGEE-Utrecht',
    is_on_previous_memberslist: true,
    answers: ['To learn', false]
});

// Serves the event and the list of its applications; `list` decides per request.
const mockPage = (api: ApiMock, {
    event = agora(),
    list = () => okList([ALEX, JAN])
}: { event?: StatutoryEvent; list?: (request: MockRequest) => ReturnType<typeof okList<ListedApplication>> } = {}) => {
    api.json('GET statutory /events/:id', ok(event));
    api.on('GET statutory /events/:id/applications/all', (request) => ({ json: list(request) }));
};

const listCalls = (api: ApiMock) => api.callsTo('GET statutory /events/:id/applications/all');

const applicationsTable = (page: Page) => page.getByRole('region', { name: 'Applications' }).getByRole('table');
const rowOf = (page: Page, name: string) => tableRows(applicationsTable(page)).filter({ hasText: name });

// Every cell of `row`, column by column: its count, and the text under each header.
const expectCells = async (table: Locator, row: Locator, cells: [string, string | RegExp][]) => {
    await expect(row.getByRole('cell')).toHaveCount(cells.length);
    for (const [column, text] of cells) {
        await test.step(`cell under "${column}"`, async () => expect(await cellOf(table, row, column)).toHaveText(text));
    }
};

const fieldsPicker = (page: Page) => page.getByRole('combobox', { name: 'Application fields' });

// Ticks the fields in the picker and closes it again.
const pickFields = async (page: Page, ...fields: (string | RegExp)[]) => {
    await fieldsPicker(page).click();
    for (const field of fields) await page.getByRole('listbox').getByRole('option', { name: field }).click();
    await fieldsPicker(page).press('Escape');
    await expect(page.getByRole('listbox')).toBeHidden();
};

test.describe('managing the applications to a statutory event', () => {
    test('every cell stays under its header after load, after adding a question column and after showing cancelled applications', async ({ page, api }) => {
        // Buefy's columns are renderless: a column that came and went could leave the cells
        // of the columns after it under the wrong headers ("View" under "Confirmed?").
        mockPage(api, { list: () => okList([JAN]) });
        await page.goto('/statutory/agora-spring/applications');

        const table = applicationsTable(page);
        const row = rowOf(page, 'Jansen');
        const leading: [string, string | RegExp][] = [
            ['#', '001-0002'],
            ['User ID', '7'],
            ['Body', 'AEGEE-Utrecht'],
            ['Is on memberslist?', 'No'],
            ['Was on previous memberslist?', 'Yes'],
            ['First name', 'Jan'],
            ['Last name', 'Jansen'],
            // The board hasn't set these yet.
            ['Participant type', ''],
            ['Board comment', '']
        ];
        const trailing: [string, string | RegExp][] = [
            ['Confirmed?', 'No'],
            ['Attended?', 'No'],
            ['Manage status', /Pending\s*Accepted\s*Waiting list\s*Rejected/],
            ['View', 'View'],
            ['Edit', 'Edit']
        ];

        await test.step('after the event loads', () => expectCells(table, row, [...leading, ...trailing]));

        await test.step('after adding the question column', async () => {
            await pickFields(page, /^Why do you want to go\?/);
            await expectCells(table, row, [...leading, ['Why do you want to go?', 'To learn'], ...trailing]);
        });

        await test.step('after showing cancelled applications', async () => {
            await page.getByRole('button', { name: 'Display all applications' }).click();
            await expect(page.getByRole('button', { name: 'Display only not cancelled applications' })).toBeVisible();
            await expectCells(table, row, [...leading, ['Why do you want to go?', 'To learn'], ['Cancelled?', 'No'], ...trailing]);
        });
    });

    test('a manager sees every application with the default fields', async ({ page, api }) => {
        mockPage(api);
        await page.goto('/statutory/agora-spring/applications');

        await expect(page.getByRole('heading', { name: 'Manage applications' })).toBeVisible();
        await expect(page).toHaveTitle('MyAEGEE | Manage participants for the statutory event');
        await expect(page.getByText('Total participants: 2')).toBeVisible();
        await expect(page.getByText('4 fields selected')).toBeVisible();

        const table = applicationsTable(page);
        await expect(tableRows(table)).toHaveCount(2);
        const alex = rowOf(page, 'Alex');
        await expect(await cellOf(table, alex, '#')).toHaveText('001-0001');
        await expect(await cellOf(table, alex, 'User ID')).toHaveText('2');
        await expect(await cellOf(table, alex, 'Body')).toHaveText('AEGEE-Antenna');
        await expect(await cellOf(table, alex, 'Participant type')).toHaveText('delegate (1)');
        await expect(await cellOf(table, alex, 'Board comment')).toHaveText('Active in the antenna');
        await expect(await cellOf(table, alex, 'Confirmed?')).toHaveText('Yes');
        await expect(await cellOf(table, alex, 'Attended?')).toHaveText('No');
        await expect(page.getByRole('combobox', { name: 'Status of Alex Member' })).toHaveValue('pending');
        await expect(await cellOf(table, rowOf(page, 'Jansen'), 'Participant type')).toHaveText('');

        // The first page, newest first.
        const [first] = listCalls(api);
        expect(Object.fromEntries(first.query)).toEqual({ limit: '50', offset: '0', 'sort[field]': 'id', 'sort[order]': 'desc' });
    });

    test('changing the status of an application saves it', async ({ page, api }) => {
        mockPage(api);
        api.json('PUT statutory /events/:id/applications/:application_id/status', ok(ALEX));
        await page.goto('/statutory/agora-spring/applications');

        await page.getByRole('combobox', { name: 'Status of Alex Member' }).selectOption('Accepted');

        await expect(toast(page, 'Successfully updated status of application for user #2 to "accepted"')).toBeVisible();
        expect(api.callsTo('PUT statutory /events/:id/applications/:application_id/status').map((call) => [call.params, call.body]))
            .toEqual([[{ id: 'agora-spring', application_id: '12' }, { status: 'accepted' }]]);
        await expect(page.getByRole('combobox', { name: 'Status of Alex Member' })).toHaveValue('accepted');
    });

    test('a status the service refuses is shown, and the select goes back to the stored status', async ({ page, api }) => {
        mockPage(api);
        api.on('PUT statutory /events/:id/applications/:application_id/status', {
            status: 403, json: forbidden('You don\'t have permissions to change the "status" attribute of this application.')
        });
        await page.goto('/statutory/agora-spring/applications');

        await page.getByRole('combobox', { name: 'Status of Alex Member' }).selectOption('Rejected');

        await expect(toast(page, 'Could not update participant status: You don\'t have permissions to change the "status" attribute of this application.')).toBeVisible();
        await expect(page.getByRole('combobox', { name: 'Status of Alex Member' })).toHaveValue('pending');
    });

    test('an Agora shows whether each applicant is on the members list', async ({ page, api }) => {
        mockPage(api);
        await page.goto('/statutory/agora-spring/applications');

        const table = applicationsTable(page);
        await expect(await cellOf(table, rowOf(page, 'Alex'), 'Is on memberslist?')).toHaveText('Yes');
        await expect(await cellOf(table, rowOf(page, 'Alex'), 'Was on previous memberslist?')).toHaveText('No');
        await expect(await cellOf(table, rowOf(page, 'Jansen'), 'Is on memberslist?')).toHaveText('No');
        await expect(await cellOf(table, rowOf(page, 'Jansen'), 'Was on previous memberslist?')).toHaveText('Yes');
    });

    test('an EPM has no members list columns', async ({ page, api }) => {
        mockPage(api, { event: agora({ type: 'epm', url: 'epm-spring' }) });
        await page.goto('/statutory/epm-spring/applications');

        const table = applicationsTable(page);
        const alex = rowOf(page, 'Alex');
        await expect(await cellOf(table, alex, 'Body')).toHaveText('AEGEE-Antenna');
        await expect(await cellOf(table, alex, 'Participant type')).toHaveText('delegate (1)');
        await expect(await cellOf(table, alex, 'Confirmed?')).toHaveText('Yes');
        // #, User ID, Body, the four fields, Confirmed?, Attended?, Manage status, View, Edit.
        await expect(alex.getByRole('cell')).toHaveCount(12);
    });

    test('picking a question in the fields adds a column with the answers', async ({ page, api }) => {
        mockPage(api);
        await page.goto('/statutory/agora-spring/applications');

        await pickFields(page, /^I need a visa/, /^Email/);

        await expect(page.getByText('6 fields selected')).toBeVisible();
        const table = applicationsTable(page);
        await expect(await cellOf(table, rowOf(page, 'Alex'), 'I need a visa')).toHaveText('Yes');
        await expect(await cellOf(table, rowOf(page, 'Jansen'), 'I need a visa')).toHaveText('No');
        await expect(await cellOf(table, rowOf(page, 'Jansen'), 'Email')).toHaveText('member7@example.com');
    });

    test('every field of the picker shows the applicants\' details', async ({ page, api }) => {
        const visa = {
            visa_required: true,
            visa_passport_number: 'AB123456',
            visa_passport_issue_date: '2020-01-01',
            visa_passport_expiration_date: '2030-01-01',
            visa_passport_issue_authority: 'City of Brussels',
            visa_place_of_birth: 'Leuven',
            visa_embassy: 'Brussels',
            visa_street_and_house: 'Example Street 12',
            visa_postal_code: '1000',
            visa_city: 'Brussels',
            visa_country: 'Belgium'
        };
        mockPage(api, {
            list: () => okList([
                { ...ALEX, ...visa, status: 'rejected', allergies: 'Nuts', number_of_events_visited: 2, created_at: '2027-01-10T09:30:00.000Z', updated_at: '2027-01-11T09:30:00.000Z' },
                { ...JAN, status: 'waiting_list' }
            ])
        });
        await page.goto('/statutory/agora-spring/applications');
        const fields: [string, string][] = [
            ['Gender', 'female'],
            ['Nationality', 'Belgian'],
            ['Date of birth', '2000-01-01'],
            ['Email', 'member2@example.com'],
            ['Meals', 'Vegetarian'],
            ['Allergies', 'Nuts'],
            ['Number of events visited', '2'],
            ['Visa required?', 'Yes'],
            ['Visa passport number', 'AB123456'],
            ['Visa passport issue date', '2020-01-01'],
            ['Visa passport expiration date', '2030-01-01'],
            ['Visa passport issue authority', 'City of Brussels'],
            ['Place of birth', 'Leuven'],
            ['Embassy', 'Brussels'],
            ['Street and house number', 'Example Street 12'],
            ['Postal code', '1000'],
            ['City', 'Brussels'],
            ['Country', 'Belgium'],
            // As statutory sends them.
            ['Created at', '2027-01-10T09:30:00.000Z'],
            ['Updated at', '2027-01-11T09:30:00.000Z']
        ];

        await pickFields(page, ...fields.map(([name]) => new RegExp(`^${name.replace('?', '\\?')}(\\s|$)`)));

        await expect(page.getByText('24 fields selected')).toBeVisible();
        const alex = rowOf(page, 'Alex');
        for (const [column, text] of fields) {
            await expect(await cellOf(applicationsTable(page), alex, column)).toHaveText(text);
        }
        await expect(page.getByRole('combobox', { name: 'Status of Alex Member' })).toHaveValue('rejected');
        await expect(page.getByRole('combobox', { name: 'Status of Jan Jansen' })).toHaveValue('waiting_list');
    });

    test('a question named like a field adds only its own column', async ({ page, api }) => {
        mockPage(api, { event: agora({ questions: [{ type: 'string', description: 'Gender', required: false }] }) });
        await page.goto('/statutory/agora-spring/applications');

        // The picker tells the question apart from the field.
        await fieldsPicker(page).click();
        await page.getByRole('listbox').getByRole('option', { name: /^Gender \(question 1\)/ }).click();
        await fieldsPicker(page).press('Escape');

        await expect(page.getByText('5 fields selected')).toBeVisible();
        await expect(rowOf(page, 'Alex').getByRole('cell')).toHaveCount(15);
        await expect(await cellOf(applicationsTable(page), rowOf(page, 'Alex'), 'Gender')).toHaveText('To meet the network');
    });

    test('sorting by a column asks the service for that order', async ({ page, api, layout }) => {
        mockPage(api);
        await page.goto('/statutory/agora-spring/applications');
        await expect(tableRows(applicationsTable(page))).toHaveCount(2);

        // The page sorts a column it isn't sorted by yet newest first.
        await sortBy(applicationsTable(page), 'User ID', layout);

        await expect.poll(() => listCalls(api).length).toBe(2);
        expect(listCalls(api).at(-1)?.query.get('sort[field]')).toBe('user_id');
        expect(listCalls(api).at(-1)?.query.get('sort[order]')).toBe('desc');
    });

    test('sorting by the previous members list asks for the column the service has', async ({ page, api, layout }) => {
        mockPage(api);
        await page.goto('/statutory/agora-spring/applications');
        await expect(tableRows(applicationsTable(page))).toHaveCount(2);

        await sortBy(applicationsTable(page), 'Was on previous memberslist?', layout);

        await expect.poll(() => listCalls(api).length).toBe(2);
        expect(listCalls(api).at(-1)?.query.get('sort[field]')).toBe('is_on_previous_memberslist');
    });

    test('the email and the answers can\'t be sorted by, as the service has no such column', {
        tag: '@desktop-only',
        annotation: { type: 'desktop-only', description: 'the phone has the sort select instead of clickable headers (covered by the next test)' }
    }, async ({ page, api }) => {
        mockPage(api);
        await page.goto('/statutory/agora-spring/applications');
        await pickFields(page, /^I need a visa/, /^Email/);
        const table = applicationsTable(page);

        // eslint-disable-next-line no-restricted-syntax -- clicking a header is what this desktop test is about
        await table.getByRole('columnheader', { name: 'Email' }).click();
        // eslint-disable-next-line no-restricted-syntax -- clicking a header is what this desktop test is about
        await table.getByRole('columnheader', { name: 'I need a visa' }).click();
        // eslint-disable-next-line no-restricted-syntax -- clicking a header is what this desktop test is about
        await table.getByRole('columnheader', { name: 'User ID' }).click();

        await expect.poll(() => listCalls(api).length).toBe(2);
        expect(listCalls(api).map((call) => call.query.get('sort[field]'))).toEqual(['id', 'user_id']);
    });

    test('the sort control offers neither the email nor the answers', { tag: '@phone-only' }, async ({ page, api }) => {
        mockPage(api);
        await page.goto('/statutory/agora-spring/applications');
        await pickFields(page, /^I need a visa/, /^Email/);

        const sortControl = page.getByRole('combobox').filter({ has: page.getByRole('option', { name: 'User ID', exact: true }) });
        await expect(sortControl.getByRole('option', { name: 'First name', exact: true })).toHaveCount(1);
        await expect(sortControl.getByRole('option', { name: 'Email', exact: true })).toHaveCount(0);
        await expect(sortControl.getByRole('option', { name: 'I need a visa', exact: true })).toHaveCount(0);
    });

    test('searching asks the service with the text, from the first page', async ({ page, api }) => {
        mockPage(api, { list: () => okList([ALEX, JAN], 60) });
        await page.goto('/statutory/agora-spring/applications');
        await page.getByRole('button', { name: 'Next page' }).click();
        await expect.poll(() => listCalls(api).length).toBe(2);

        await page.getByRole('textbox', { name: 'Search by name, surname or statutory ID' }).fill('Jan');
        await expect.poll(() => listCalls(api).length).toBe(3);
        expect(listCalls(api)[2].query.get('query')).toBe('Jan');
        expect(listCalls(api)[2].query.get('offset')).toBe('0');

        await page.getByRole('textbox', { name: 'Search by name, surname or statutory ID' }).fill('');
        await expect.poll(() => listCalls(api).length).toBe(4);
        expect(listCalls(api)[3].query.has('query')).toBe(false);

        // The event is the same for every search.
        expect(api.callsTo('GET statutory /events/:id')).toHaveLength(1);
    });

    test('a late answer to an earlier search doesn\'t replace the answer to the last one', async ({ page, api }) => {
        mockPage(api);
        // The answer to "Ja" is held back until the one to "Jan" is shown.
        let release = (): void => undefined;
        const released = new Promise<void>((resolve) => { release = resolve; });
        api.on('GET statutory /events/:id/applications/all', async ({ query }) => {
            if (query.get('query') === 'Ja') {
                await released;
                return { json: okList([ALEX, JAN]) };
            }
            return { json: okList(query.get('query') === 'Jan' ? [JAN] : [ALEX, JAN]) };
        });
        const late = page.waitForResponse((response) => new URL(response.url()).searchParams.get('query') === 'Ja');
        await page.goto('/statutory/agora-spring/applications');
        await expect(tableRows(applicationsTable(page))).toHaveCount(2);

        await page.getByRole('textbox', { name: 'Search by name, surname or statutory ID' }).fill('Ja');
        await page.getByRole('textbox', { name: 'Search by name, surname or statutory ID' }).fill('Jan');
        await expect(tableRows(applicationsTable(page))).toHaveCount(1);
        release();
        await (await late).finished();
        // Lets the page handle the answer it has just received (two turns of its event loop), so that what is checked below is after it
        await page.evaluate(() => new Promise((resolve) => { setTimeout(() => setTimeout(resolve, 0), 0); }));

        await expect(tableRows(applicationsTable(page))).toHaveText([/Jansen/]);
    });

    test('a late failure of an earlier search shows no error', async ({ page, api }) => {
        mockPage(api);
        let release = (): void => undefined;
        const released = new Promise<void>((resolve) => { release = resolve; });
        api.on('GET statutory /events/:id/applications/all', async ({ query }) => {
            if (query.get('query') === 'Ja') {
                await released;
                return { status: 500, json: { success: false, message: 'Internal server error.' } };
            }
            return { json: okList(query.get('query') === 'Jan' ? [JAN] : [ALEX, JAN]) };
        });
        const late = page.waitForResponse((response) => new URL(response.url()).searchParams.get('query') === 'Ja');
        await page.goto('/statutory/agora-spring/applications');
        await expect(tableRows(applicationsTable(page))).toHaveCount(2);

        await page.getByRole('textbox', { name: 'Search by name, surname or statutory ID' }).fill('Ja');
        await page.getByRole('textbox', { name: 'Search by name, surname or statutory ID' }).fill('Jan');
        await expect(tableRows(applicationsTable(page))).toHaveCount(1);
        release();
        await (await late).finished();
        await page.evaluate(() => new Promise((resolve) => { setTimeout(() => setTimeout(resolve, 0), 0); }));

        // Counted at once: a toast goes away by itself, so waiting for none would always pass.
        expect(await toast(page, /Internal server error/).count()).toBe(0);
        await expect(page).toHaveURL('/statutory/agora-spring/applications');
        await expect(tableRows(applicationsTable(page))).toHaveText([/Jansen/]);
    });

    test('a page left while its search runs shows no late error and stays left', async ({ page, api, layout }) => {
        api.fallback(mockEverything);
        mockPage(api);
        let release = (): void => undefined;
        const released = new Promise<void>((resolve) => { release = resolve; });
        api.on('GET statutory /events/:id/applications/all', async ({ query }) => {
            if (query.get('query') !== 'Ja') return { json: okList([ALEX, JAN]) };
            await released;
            return { status: 500, json: { success: false, message: 'Internal server error.' } };
        });
        const asked = page.waitForRequest((request) => new URL(request.url()).searchParams.get('query') === 'Ja');
        const late = page.waitForResponse((response) => new URL(response.url()).searchParams.get('query') === 'Ja');
        await page.goto('/statutory/agora-spring/applications');
        await expect(tableRows(applicationsTable(page))).toHaveCount(2);
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

    test('cancelled applications are shown on request', async ({ page, api }) => {
        mockPage(api, {
            list: ({ query }) => okList(query.get('displayCancelled') === 'true' ? [ALEX, { ...JAN, cancelled: true }] : [ALEX])
        });
        await page.goto('/statutory/agora-spring/applications');
        await expect(tableRows(applicationsTable(page))).toHaveCount(1);

        await page.getByRole('button', { name: 'Display all applications' }).click();

        await expect(tableRows(applicationsTable(page))).toHaveCount(2);
        await expect(await cellOf(applicationsTable(page), rowOf(page, 'Jansen'), 'Cancelled?')).toHaveText('Yes');
        expect(listCalls(api).at(-1)?.query.get('displayCancelled')).toBe('true');

        await page.getByRole('button', { name: 'Display only not cancelled applications' }).click();

        await expect(tableRows(applicationsTable(page))).toHaveCount(1);
        await expect(page.getByRole('button', { name: 'Display all applications' })).toBeVisible();
        expect(listCalls(api).at(-1)?.query.has('displayCancelled')).toBe(false);
    });

    test('the next page asks for the next 50 applications', async ({ page, api }) => {
        mockPage(api, { list: () => okList([ALEX, JAN], 60) });
        await page.goto('/statutory/agora-spring/applications');
        await expect(page.getByText('Total participants: 60')).toBeVisible();

        await page.getByRole('button', { name: 'Next page' }).click();

        await expect.poll(() => listCalls(api).length).toBe(2);
        expect(listCalls(api)[1].query.get('offset')).toBe('50');
        expect(listCalls(api)[1].query.get('limit')).toBe('50');
    });

    test('the links lead to each application and its edit page', async ({ page, api }) => {
        mockPage(api, { list: () => okList([ALEX, { ...JAN, statutory_id: null as unknown as string }]) });
        await page.goto('/statutory/agora-spring/applications');

        const table = applicationsTable(page);
        // The columns are final once the rows are there: read the column positions after that.
        await expect(tableRows(table)).toHaveCount(2);
        await expect((await cellOf(table, rowOf(page, 'Alex'), 'View')).getByRole('link', { name: 'View' })).toHaveAttribute('href', '/statutory/agora-spring/applications/001-0001');
        await expect((await cellOf(table, rowOf(page, 'Alex'), 'Edit')).getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/statutory/agora-spring/applications/001-0001/edit');
        // Without a statutory ID, by the id.
        await expect((await cellOf(table, rowOf(page, 'Jansen'), 'View')).getByRole('link', { name: 'View' })).toHaveAttribute('href', '/statutory/agora-spring/applications/13');
    });

    test('without managing applications there is no edit link', async ({ page, api }) => {
        mockPage(api, { event: agora({ permissions: statutoryManagerPermissions({ manage_applications: false }) }) });
        await page.goto('/statutory/agora-spring/applications');

        await expect(tableRows(applicationsTable(page))).toHaveCount(2);
        await expect(applicationsTable(page).getByRole('link', { name: 'View' })).toHaveCount(2);
        await expect(applicationsTable(page).getByRole('link', { name: 'Edit' })).toHaveCount(0);
    });

    test('an event without applications says so', async ({ page, api }) => {
        mockPage(api, { list: () => okList([]) });
        await page.goto('/statutory/agora-spring/applications');

        await expect.poll(() => listCalls(api).length).toBe(1);
        await expectEmptyTable(applicationsTable(page));
        await expect(page.getByText('Total participants: 0')).toBeVisible();
    });

    test('the table says it is loading while the applications come', async ({ page, api }) => {
        api.json('GET statutory /events/:id', ok(agora()));
        api.on('GET statutory /events/:id/applications/all', { json: okList([ALEX]), delayMs: 1000 });
        await page.goto('/statutory/agora-spring/applications');

        await expect(page.getByRole('region', { name: 'Applications' })).toHaveAttribute('aria-busy', 'true');
        await expect(page.getByRole('region', { name: 'Applications' })).toHaveAttribute('aria-busy', 'false');
        await expect(tableRows(applicationsTable(page))).toHaveCount(1);
    });

    test('an unknown event goes back to the list of statutory events', async ({ page, api }) => {
        api.fallback(mockEverything);
        api.on('GET statutory /events/:id', { status: 404, json: notFound('Event with such url or ID is not found.') });
        await page.goto('/statutory/nope/applications');

        await expect(toast(page, 'Event is not found')).toBeVisible();
        await expect(page).toHaveURL('/statutory');
    });

    test('someone who may not see the applications goes back to the list of statutory events', async ({ page, api }) => {
        api.fallback(mockEverything);
        api.json('GET statutory /events/:id', ok(agora({ permissions: statutoryManagerPermissions({ see_applications: false }) })));
        api.on('GET statutory /events/:id/applications/all', { status: 403, json: forbidden('You are not allowed to see applications.') });
        await page.goto('/statutory/agora-spring/applications');

        await expect(toast(page, 'Some error happened: You are not allowed to see applications.')).toBeVisible();
        await expect(page).toHaveURL('/statutory');
    });

    test('a failing service goes back to the list of statutory events', async ({ page, api }) => {
        api.fallback(mockEverything);
        api.on('GET statutory /events/:id', { status: 500, json: { success: false, message: 'Internal server error.' } });
        await page.goto('/statutory/agora-spring/applications');

        await expect(toast(page, 'Some error happened: Internal server error.')).toBeVisible();
        await expect(page).toHaveURL('/statutory');
    });
});
