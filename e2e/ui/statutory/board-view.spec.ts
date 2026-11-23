// The board view of a statutory event (/statutory/:id/boardview): a body's board sees who of
// the body applied, and gives the participant places the body has (delegate 1, visitor 3, …)
// to applicants.
import type { Locator, Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { forbidden, notFound, ok, okList, validationError } from '../support/factories/base.ts';
import { body } from '../support/factories/core.ts';
import { listedApplication, paxLimit, type ListedApplication, type PaxLimit } from '../support/factories/statutory-applications.ts';
import { statutoryEvent, statutoryEventPermissions, type StatutoryEvent, type StatutoryEventPermissions } from '../support/factories/statutory-events.ts';
import { cellOf, expectEmptyTable, tableRows, toast } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { test, expect } from '../support/test.ts';

test.use({ session: 'board' });

// The board of body 1 during the board's approval period.
const boardPermissions = (overrides: Partial<StatutoryEventPermissions> = {}) => statutoryEventPermissions({
    see_boardview: { global: false, 1: true },
    set_board_comment_and_participant_type: { global: false, 1: true },
    ...overrides
});

const agora = (overrides: Partial<StatutoryEvent> = {}): StatutoryEvent => statutoryEvent({
    url: 'agora-spring',
    board_approve_deadline: '2027-03-20T22:59:00.000Z',
    questions: [{ type: 'string', description: 'Why do you want to go?', required: true }],
    permissions: boardPermissions(),
    ...overrides
});

const ALEX = listedApplication({
    id: 12,
    statutory_id: '001-0001',
    user_id: 2,
    first_name: 'Alex',
    last_name: 'Member',
    participant_type: 'delegate',
    participant_order: 1,
    board_comment: 'Active in the antenna',
    is_on_memberslist: true,
    answers: ['To meet the network']
});
const JAN = listedApplication({ id: 13, statutory_id: '001-0002', user_id: 7, first_name: 'Jan', last_name: 'Jansen', status: 'accepted', answers: ['To learn'] });
const KIM = listedApplication({ id: 14, statutory_id: '001-0003', user_id: 8, first_name: 'Kim', last_name: 'Visitor', cancelled: true, status: 'rejected', answers: ['Why not'] });

const mockPage = (api: ApiMock, {
    event = agora(),
    applications = [ALEX, JAN, KIM],
    limit = paxLimit()
}: { event?: StatutoryEvent; applications?: ListedApplication[]; limit?: PaxLimit } = {}) => {
    api.json('GET statutory /events/:id', ok(event));
    api.json('GET statutory /events/:id/applications/boardview/:body_id', ok(applications));
    api.json('GET statutory /limits/:event_type/:body_id', ok(limit));
};

const editPanel = (page: Page) => page.getByRole('tabpanel', { name: 'Edit boardview' });
const viewPanel = (page: Page) => page.getByRole('tabpanel', { name: 'View applications' });
const slotsTable = (page: Page) => editPanel(page).getByRole('table');
const applicationsTable = (page: Page) => viewPanel(page).getByRole('table');
const userOf = (page: Page, slot: string) => page.getByRole('combobox', { name: `User for ${slot}`, exact: true });
const commentOf = (page: Page, slot: string) => page.getByRole('textbox', { name: `Board comment for ${slot}`, exact: true });
const posts = (api: ApiMock) => api.callsTo('POST statutory /events/:id/applications/boardview/:body_id');

const fieldsPicker = (page: Page) => page.getByRole('combobox', { name: 'Application fields' });

// Every cell of `row`, column by column: its count, and the text under each header.
const expectCells = async (table: Locator, row: Locator, cells: [string, string | RegExp][]) => {
    await expect(row.getByRole('cell')).toHaveCount(cells.length);
    for (const [column, text] of cells) {
        await test.step(`cell under "${column}"`, async () => expect(await cellOf(table, row, column)).toHaveText(text));
    }
};

test.describe('the board view of a statutory event', () => {
    test('the board of a body sees what it may send, and who has which place', async ({ page, api }) => {
        mockPage(api);
        await page.goto('/statutory/agora-spring/boardview');

        await expect(page.getByRole('heading', { name: 'Board view', exact: true })).toBeVisible();
        await expect(page).toHaveTitle('MyAEGEE | Board view for statutory events.');
        await expect(page.getByRole('combobox', { name: 'Select the body to view application from:' })).toHaveValue('1');
        await expect(page.getByRole('listitem').filter({ hasText: /^3 delegates$/ })).toBeVisible();
        await expect(page.getByRole('listitem').filter({ hasText: /^30 visitors$/ })).toBeVisible();
        await expect(page.getByText(/envoys|observers/)).toHaveCount(0);
        await expect(page.getByText('The deadline for board approval is: 2027-03-20 23:59 (local time).')).toBeVisible();

        await expect(page.getByRole('tab', { name: 'Edit boardview' })).toHaveAttribute('aria-selected', 'true');
        // Three delegates and thirty visitors.
        await expect(tableRows(slotsTable(page))).toHaveCount(33);
        await expect(userOf(page, 'delegate 1')).toHaveValue('2');
        await expect(commentOf(page, 'delegate 1')).toHaveValue('Active in the antenna');
        await expect(userOf(page, 'delegate 2')).toHaveValue('');
        await expect(userOf(page, 'visitor 30').getByRole('option')).toHaveText(['Not set', 'Alex Member', 'Jan Jansen', 'Kim Visitor']);
        expect(api.callsTo('GET statutory /limits/:event_type/:body_id').map((call) => call.params)).toEqual([{ event_type: 'agora', body_id: '1' }]);
    });

    test('giving places saves the filled ones, and shows them afterwards', async ({ page, api }) => {
        mockPage(api);
        api.on('POST statutory /events/:id/applications/boardview/:body_id', () => {
            // What statutory has from now on.
            api.json('GET statutory /events/:id/applications/boardview/:body_id', ok([ALEX, { ...JAN, participant_type: 'delegate', participant_order: 2 }, KIM]));
            return { json: ok([]) };
        });
        await page.goto('/statutory/agora-spring/boardview');

        await userOf(page, 'delegate 2').selectOption({ label: 'Jan Jansen' });
        await commentOf(page, 'delegate 2').fill('Motivated');
        await page.getByRole('button', { name: 'Save!' }).click();

        await expect(toast(page, 'Participants info is successfully updated.')).toBeVisible();
        expect(posts(api).map((call) => [call.params.body_id, call.body])).toEqual([['1', [
            { participant_type: 'delegate', participant_order: 1, user_id: 2, board_comment: 'Active in the antenna' },
            { participant_type: 'delegate', participant_order: 2, user_id: 7, board_comment: 'Motivated' }
        ]]]);

        await page.getByRole('tab', { name: 'View applications' }).click();
        await expect(await cellOf(applicationsTable(page), tableRows(applicationsTable(page)).filter({ hasText: 'Jansen' }), 'Participant type and order')).toHaveText('delegate (2)');
    });

    test('the save button waits for the answer, so the places are sent once', async ({ page, api }) => {
        mockPage(api);
        api.on('POST statutory /events/:id/applications/boardview/:body_id', { json: ok([]), delayMs: 1000 });
        await page.goto('/statutory/agora-spring/boardview');

        await page.getByRole('button', { name: 'Save!' }).click();

        await expect(page.getByRole('button', { name: 'Save!' })).toBeDisabled();
        await expect(toast(page, 'Participants info is successfully updated.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Save!' })).toBeEnabled();
        expect(posts(api)).toHaveLength(1);
    });

    test('an applicant can\'t have two places', async ({ page, api }) => {
        mockPage(api);
        await page.goto('/statutory/agora-spring/boardview');

        await userOf(page, 'visitor 1').selectOption({ label: 'Alex Member' });
        await page.getByRole('button', { name: 'Save!' }).click();

        await expect(toast(page, 'You\'ve specified one user multiple times, please remove any duplicate users and try again.')).toBeVisible();
        expect(posts(api)).toEqual([]);
    });

    test('a comment needs an applicant', async ({ page, api }) => {
        mockPage(api);
        await page.goto('/statutory/agora-spring/boardview');

        await commentOf(page, 'delegate 3').fill('Who?');
        await page.getByRole('button', { name: 'Save!' }).click();

        await expect(toast(page, 'You\'ve specified a board comment but didn\'t select an application for it. Either remove the board comment or select an applicant for it.')).toBeVisible();
        expect(posts(api)).toEqual([]);
    });

    test('shows why statutory refused the places', async ({ page, api }) => {
        mockPage(api);
        api.on('POST statutory /events/:id/applications/boardview/:body_id', {
            status: 422,
            json: validationError({
                participant_type: ['Participant type should be one of these: delegate, envoy, observer, visitor.'],
                participant_order: ['Participant order should be a number.'],
                participantTypeShouldBeSetWithOrder: ['Participant type should be set together with participant order.'],
                board_comment: ['Board comment is too long.'],
                user_id: ['There\'s no application of this user for this body.']
            })
        });
        await page.goto('/statutory/agora-spring/boardview');

        await page.getByRole('button', { name: 'Save!' }).click();

        const errors = editPanel(page).getByRole('listitem');
        await expect(page.getByText('These errors occurred while trying to update the participant:')).toBeVisible();
        await expect(errors).toHaveText([
            'Participant type: Participant type should be one of these: delegate, envoy, observer, visitor.',
            'Participant order: Participant order should be a number.',
            'Participant type should be set together with participant order.',
            'Board comment: Board comment is too long.',
            'There\'s no application of this user for this body.'
        ]);
    });

    test('a body over its limit is refused', async ({ page, api }) => {
        mockPage(api);
        api.on('POST statutory /events/:id/applications/boardview/:body_id', {
            status: 403, json: forbidden('Too much applications for body #1 for type "delegate": expected 3, got 4.')
        });
        await page.goto('/statutory/agora-spring/boardview');

        await page.getByRole('button', { name: 'Save!' }).click();

        await expect(toast(page, 'Could not update participants info: Too much applications for body #1 for type "delegate": expected 3, got 4.')).toBeVisible();
    });

    test('a body that may send any number of observers gets thirty places for them', async ({ page, api }) => {
        mockPage(api, { limit: paxLimit({ delegate: 0, visitor: 0, observer: null }) });
        await page.goto('/statutory/agora-spring/boardview');

        await expect(page.getByRole('listitem').filter({ hasText: /^Unlimited amount of observers$/ })).toBeVisible();
        await expect(tableRows(slotsTable(page))).toHaveCount(30);
        await expect(userOf(page, 'observer 30')).toBeVisible();
    });

    test('a body that may send nobody to an Agora has only the applications to look at', async ({ page, api }) => {
        mockPage(api, { limit: paxLimit({ delegate: 0, visitor: 0 }) });
        await page.goto('/statutory/agora-spring/boardview');

        await expect(page.getByText('Your body cannot send any participants to Agora.')).toBeVisible();
        await expect(page.getByText(/The deadline for board approval/)).toHaveCount(0);
        await expect(page.getByRole('tab', { name: 'Edit boardview' })).toBeHidden();
        await expect(page.getByRole('tab', { name: 'View applications' })).toHaveAttribute('aria-selected', 'true');
        await expect(tableRows(applicationsTable(page))).toHaveCount(2);
        await expect(fieldsPicker(page)).toHaveCount(0);
    });

    test('a body that may send nobody to an EPM is told so', async ({ page, api }) => {
        mockPage(api, { event: agora({ type: 'epm', url: 'epm-spring' }), limit: paxLimit({ event_type: 'epm', delegate: 0, visitor: 0 }) });
        await page.goto('/statutory/epm-spring/boardview');

        await expect(page.getByText('Your body cannot send any participants to EPM.')).toBeVisible();
        await expect(page.getByRole('tab', { name: 'View applications' })).toHaveAttribute('aria-selected', 'true');
        expect(api.callsTo('GET statutory /limits/:event_type/:body_id').map((call) => call.params.event_type)).toEqual(['epm']);
    });

    test('after the board\'s deadline the board only sees the applications', async ({ page, api }) => {
        mockPage(api, { event: agora({ permissions: boardPermissions({ set_board_comment_and_participant_type: { global: false, 1: false } }) }) });
        await page.goto('/statutory/agora-spring/boardview');

        await expect(page.getByRole('tab', { name: 'View applications' })).toHaveAttribute('aria-selected', 'true');
        await expect(page.getByRole('tab', { name: 'Edit boardview' })).toBeHidden();
        await expect(tableRows(applicationsTable(page))).toHaveCount(2);
        await expect(page.getByRole('button', { name: 'Save!' })).toBeHidden();
    });

    test('the applications of the body, with their status', async ({ page, api }) => {
        mockPage(api);
        await page.goto('/statutory/agora-spring/boardview');
        await page.getByRole('tab', { name: 'View applications' }).click();

        await expect(page.getByRole('tab', { name: 'View applications' })).toHaveAttribute('aria-selected', 'true');
        const table = applicationsTable(page);
        // Cancelled applications are left out.
        await expect(tableRows(table)).toHaveCount(2);
        const alex = tableRows(table).filter({ hasText: 'Alex Member' });
        await expectCells(table, alex, [
            ['#', '001-0001'],
            ['First and last name', 'Alex Member'],
            ['Participant type and order', 'delegate (1)'],
            ['Is on memberslist?', 'Yes'],
            ['Status', 'Pending'],
            ['View', 'View']
        ]);
        await expect(await cellOf(table, tableRows(table).filter({ hasText: 'Jansen' }), 'Status')).toHaveText('Accepted');
        await expect(await cellOf(table, tableRows(table).filter({ hasText: 'Jansen' }), 'Is on memberslist?')).toHaveText('No');
        await expect((await cellOf(table, alex, 'View')).getByRole('link', { name: 'View' })).toHaveAttribute('href', '/statutory/agora-spring/applications/001-0001');

        await page.getByRole('button', { name: 'Display all applications' }).click();

        await expect(tableRows(table)).toHaveCount(3);
        const kim = tableRows(table).filter({ hasText: 'Kim Visitor' });
        await expect(await cellOf(table, kim, 'Cancelled?')).toHaveText('Yes');
        await expect(await cellOf(table, kim, 'Status')).toHaveText('Rejected');
        await expect(await cellOf(table, alex, 'Cancelled?')).toHaveText('No');

        await page.getByRole('button', { name: 'Display only not cancelled applications' }).click();
        await expect(tableRows(table)).toHaveCount(2);
    });

    test('a waiting applicant shows as such, and an EPM has no members list column', async ({ page, api }) => {
        mockPage(api, { event: agora({ type: 'epm', url: 'epm-spring' }), applications: [{ ...JAN, status: 'waiting_list' }], limit: paxLimit({ event_type: 'epm', delegate: 0, visitor: 0, envoy: null }) });
        await page.goto('/statutory/epm-spring/boardview');
        await page.getByRole('tab', { name: 'View applications' }).click();

        const table = applicationsTable(page);
        const jan = tableRows(table).filter({ hasText: 'Jansen' });
        await expectCells(table, jan, [
            ['#', '001-0002'],
            ['First and last name', 'Jan Jansen'],
            ['Participant type and order', ''],
            ['Status', 'Waiting list'],
            ['View', 'View']
        ]);
    });

    test('searching filters the applications by name and email on the page', async ({ page, api }) => {
        // Core may not have an address for every applicant.
        mockPage(api, { applications: [{ ...ALEX, notification_email: undefined as unknown as string }, JAN] });
        await page.goto('/statutory/agora-spring/boardview');
        await page.getByRole('tab', { name: 'View applications' }).click();
        const search = page.getByRole('textbox', { name: 'Search by name, surname or email' });

        await search.fill('jans');
        await expect(tableRows(applicationsTable(page))).toHaveText([/Jan Jansen/]);
        await search.fill('member7@');
        await expect(tableRows(applicationsTable(page))).toHaveText([/Jan Jansen/]);
        await search.fill('nobody');
        await expectEmptyTable(applicationsTable(page));
        await search.fill('');
        await expect(tableRows(applicationsTable(page))).toHaveCount(2);

        expect(api.callsTo('GET statutory /events/:id/applications/boardview/:body_id')).toHaveLength(1);
    });

    test('every cell stays under its header after picking fields, a question among them', async ({ page, api }) => {
        mockPage(api);
        await page.goto('/statutory/agora-spring/boardview');
        await page.getByRole('tab', { name: 'View applications' }).click();
        const table = applicationsTable(page);
        const alex = tableRows(table).filter({ hasText: 'Alex Member' });

        await fieldsPicker(page).click();
        for (const name of [/^Email/, /^Why do you want to go\?/, /^Board comment/]) await page.getByRole('listbox').getByRole('option', { name }).click();
        await fieldsPicker(page).press('Escape');

        await expect(page.getByText('3 fields selected')).toBeVisible();
        // In the order of the picker, after the fixed columns.
        await expectCells(table, alex, [
            ['#', '001-0001'],
            ['First and last name', 'Alex Member'],
            ['Participant type and order', 'delegate (1)'],
            ['Is on memberslist?', 'Yes'],
            ['Status', 'Pending'],
            ['Email', 'member2@example.com'],
            ['Board comment', 'Active in the antenna'],
            ['Why do you want to go?', 'To meet the network'],
            ['View', 'View']
        ]);

        await page.getByRole('button', { name: 'Display all applications' }).click();
        await expectCells(table, alex, [
            ['#', '001-0001'],
            ['First and last name', 'Alex Member'],
            ['Participant type and order', 'delegate (1)'],
            ['Is on memberslist?', 'Yes'],
            ['Cancelled?', 'No'],
            ['Status', 'Pending'],
            ['Email', 'member2@example.com'],
            ['Board comment', 'Active in the antenna'],
            ['Why do you want to go?', 'To meet the network'],
            ['View', 'View']
        ]);
    });

    test('the picker shows the applicants\' details and their places', async ({ page, api }) => {
        mockPage(api, { applications: [{ ...ALEX, created_at: '2027-01-10T09:30:00.000Z', updated_at: '2027-01-11T09:30:00.000Z' }, JAN] });
        await page.goto('/statutory/agora-spring/boardview');
        await page.getByRole('tab', { name: 'View applications' }).click();

        await fieldsPicker(page).click();
        for (const name of [/^First name/, /^Last name/, /^Gender/, /^Created at/, /^Updated at/, /^Participant type/]) {
            await page.getByRole('listbox').getByRole('option', { name }).click();
        }
        await fieldsPicker(page).press('Escape');

        const table = applicationsTable(page);
        const alex = tableRows(table).filter({ hasText: 'Alex Member' });
        for (const [column, text] of [
            ['First name', 'Alex'],
            ['Last name', 'Member'],
            ['Gender', 'female'],
            ['Created at', '2027-01-10T09:30:00.000Z'],
            ['Updated at', '2027-01-11T09:30:00.000Z'],
            ['Participant type', 'delegate (1)']
        ] as const) {
            await expect(await cellOf(table, alex, column)).toHaveText(text);
        }
        await expect(await cellOf(table, tableRows(table).filter({ hasText: 'Jansen' }), 'Participant type')).toHaveText('');
    });

    test('without a statutory ID the links use the application\'s id', async ({ page, api }) => {
        mockPage(api, { event: agora({ permissions: boardPermissions({ manage_applications: true }) }), applications: [{ ...JAN, statutory_id: null as unknown as string }] });
        await page.goto('/statutory/agora-spring/boardview');
        await page.getByRole('tab', { name: 'View applications' }).click();

        const table = applicationsTable(page);
        const jan = tableRows(table).filter({ hasText: 'Jansen' });
        await expect((await cellOf(table, jan, 'View')).getByRole('link', { name: 'View' })).toHaveAttribute('href', '/statutory/agora-spring/applications/13');
        await expect((await cellOf(table, jan, 'Edit')).getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/statutory/agora-spring/applications/13/edit');
    });

    test('who manages applications can edit them from here', async ({ page, api }) => {
        mockPage(api, { event: agora({ permissions: boardPermissions({ manage_applications: true }) }) });
        await page.goto('/statutory/agora-spring/boardview');
        await page.getByRole('tab', { name: 'View applications' }).click();

        const table = applicationsTable(page);
        await expect((await cellOf(table, tableRows(table).filter({ hasText: 'Alex Member' }), 'Edit')).getByRole('link', { name: 'Edit' }))
            .toHaveAttribute('href', '/statutory/agora-spring/applications/001-0001/edit');
    });

    test('a body without applications has none to show', async ({ page, api }) => {
        mockPage(api, { applications: [] });
        await page.goto('/statutory/agora-spring/boardview');
        await expect(tableRows(slotsTable(page))).toHaveCount(33);
        await expect(userOf(page, 'delegate 1').getByRole('option')).toHaveText(['Not set']);

        await page.getByRole('tab', { name: 'View applications' }).click();

        await expectEmptyTable(applicationsTable(page));
    });

    test('a member of no board is told so', async ({ page, api }) => {
        api.json('GET statutory /events/:id', ok(agora({ permissions: statutoryEventPermissions() })));
        await page.goto('/statutory/agora-spring/boardview');

        await expect(page.getByText('You are not a board member of any body.')).toBeVisible();
        await expect(page.getByRole('combobox', { name: 'Select the body to view application from:' })).toHaveCount(0);
    });

    test('who approves members of every body picks the body', async ({ page, api }) => {
        mockPage(api, { event: agora({ permissions: boardPermissions({ see_boardview: { global: true, 1: false }, set_board_comment_and_participant_type: { global: true, 1: false } }) }) });
        api.json('GET core /bodies', okList([body({ id: 1, name: 'AEGEE-Antenna' }), body({ id: 3, name: 'AEGEE-Utrecht' })]));
        await page.goto('/statutory/agora-spring/boardview');

        await expect(page.getByText('You haven\'t selected the antenna yet.')).toBeVisible();
        const bodySelect = page.getByRole('combobox', { name: 'Select the body to view application from:' });
        await expect(bodySelect.getByRole('option')).toHaveText(['AEGEE-Antenna', 'AEGEE-Utrecht']);

        await bodySelect.selectOption('AEGEE-Utrecht');

        await expect(tableRows(slotsTable(page))).toHaveCount(33);
        await expect(page.getByText('You haven\'t selected the antenna yet.')).toBeHidden();
        expect(api.callsTo('GET statutory /events/:id/applications/boardview/:body_id').map((call) => call.params.body_id)).toEqual(['3']);
    });

    test('another body starts without the errors and search of the one before', async ({ page, api }) => {
        mockPage(api, { event: agora({ permissions: boardPermissions({ see_boardview: { global: true, 1: true }, set_board_comment_and_participant_type: { global: true, 1: true } }) }) });
        api.json('GET core /bodies', okList([body({ id: 1, name: 'AEGEE-Antenna' }), body({ id: 3, name: 'AEGEE-Utrecht' })]));
        api.on('POST statutory /events/:id/applications/boardview/:body_id', { status: 422, json: validationError({ board_comment: ['Board comment is too long.'] }) });
        await page.goto('/statutory/agora-spring/boardview');
        await page.getByRole('button', { name: 'Save!' }).click();
        await expect(page.getByText('Board comment: Board comment is too long.')).toBeVisible();
        await page.getByRole('tab', { name: 'View applications' }).click();
        await page.getByRole('textbox', { name: 'Search by name, surname or email' }).fill('jans');

        await page.getByRole('combobox', { name: 'Select the body to view application from:' }).selectOption('AEGEE-Utrecht');

        await expect(page.getByRole('tab', { name: 'Edit boardview' })).toHaveAttribute('aria-selected', 'true');
        await expect(page.getByText(/These errors occurred/)).toHaveCount(0);
        await page.getByRole('tab', { name: 'View applications' }).click();
        await expect(page.getByRole('textbox', { name: 'Search by name, surname or email' })).toHaveValue('');
        await expect(tableRows(applicationsTable(page))).toHaveCount(2);
    });

    test('shows why the bodies could not be loaded', async ({ page, api }) => {
        api.json('GET statutory /events/:id', ok(agora({ permissions: boardPermissions({ see_boardview: { global: true, 1: false } }) })));
        api.on('GET core /bodies', { status: 500, json: { success: false, message: 'Core is down' } });
        await page.goto('/statutory/agora-spring/boardview');

        await expect(toast(page, 'Could not fetch bodies: Core is down')).toBeVisible();
    });

    test('shows why the board view of a body could not be loaded', async ({ page, api }) => {
        api.json('GET statutory /events/:id', ok(agora()));
        api.on('GET statutory /events/:id/applications/boardview/:body_id', { status: 403, json: forbidden('You are not allowed to see the boardview of this body.') });
        await page.goto('/statutory/agora-spring/boardview');

        await expect(toast(page, 'Could not fetch boardview: You are not allowed to see the boardview of this body.')).toBeVisible();
    });

    test('shows why the limits of a body could not be loaded', async ({ page, api }) => {
        api.json('GET statutory /events/:id', ok(agora()));
        api.json('GET statutory /events/:id/applications/boardview/:body_id', ok([ALEX]));
        api.on('GET statutory /limits/:event_type/:body_id', { status: 500, json: { success: false, message: 'Database is down' } });
        await page.goto('/statutory/agora-spring/boardview');

        await expect(toast(page, 'Could not fetch boardview: Database is down')).toBeVisible();
    });

    test('the slots keep their order', {
        tag: '@desktop-only',
        annotation: { type: 'desktop-only', description: 'the phone has a sort select instead of clickable headers (covered by the next test)' }
    }, async ({ page, api }) => {
        // Sorted by their comments, visitor 1 would come before delegate 1.
        mockPage(api, { applications: [ALEX, { ...JAN, participant_type: 'visitor', participant_order: 1, board_comment: 'A good visitor' }] });
        await page.goto('/statutory/agora-spring/boardview');

        // eslint-disable-next-line no-restricted-syntax -- clicking a header is what this desktop test is about
        await slotsTable(page).getByRole('columnheader', { name: 'Board comment' }).click();
        // eslint-disable-next-line no-restricted-syntax -- clicking a header is what this desktop test is about
        await slotsTable(page).getByRole('columnheader', { name: 'Board comment' }).click();

        await expect(tableRows(slotsTable(page)).first()).toContainText('delegate (1)');
        await expect(tableRows(slotsTable(page)).nth(3)).toContainText('visitor (1)');
    });

    test('the slots have no sort control', { tag: '@phone-only' }, async ({ page, api }) => {
        mockPage(api);
        await page.goto('/statutory/agora-spring/boardview');

        await expect(tableRows(slotsTable(page))).toHaveCount(33);
        await expect(editPanel(page).getByRole('combobox').filter({ has: page.getByRole('option', { name: 'Board comment', exact: true }) })).toHaveCount(0);
    });

    test('an unknown event goes back to the list of statutory events', async ({ page, api }) => {
        api.fallback(mockEverything);
        api.on('GET statutory /events/:id', { status: 404, json: notFound('Event with such url or ID is not found.') });
        await page.goto('/statutory/nope/boardview');

        await expect(toast(page, 'Event is not found')).toBeVisible();
        await expect(page).toHaveURL('/statutory');
    });

    test('a failing service goes back to the list of statutory events', async ({ page, api }) => {
        api.fallback(mockEverything);
        api.on('GET statutory /events/:id', { status: 500, json: { success: false, message: 'Database is down' } });
        await page.goto('/statutory/agora-spring/boardview');

        await expect(toast(page, 'Some error happened: Database is down')).toBeVisible();
        await expect(page).toHaveURL('/statutory');
    });
});
