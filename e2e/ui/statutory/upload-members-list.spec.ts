// Sending the members list of a local for an Agora (/statutory/:id/memberslist/upload): the
// board picks its body, fetches the members and their current fees from core, corrects them
// and saves the list; after the deadlines it is told whom to ask.
import type { Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { date, FIXED_NOW, forbidden, iso, notFound, ok, validationError } from '../support/factories/base.ts';
import { body, bodyMembership, payment, type BodyMembership, type Payment } from '../support/factories/core.ts';
import { statutoryEvent, statutoryEventPermissions, type StatutoryEvent, type StatutoryEventPermissions } from '../support/factories/statutory-events.ts';
import { membersList, membersListMember, type MembersList } from '../support/factories/statutory-memberslists.ts';
import { cellOf, dialog, freezeTime, tableRows, toast } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { test, expect } from '../support/test.ts';

const ANTENNA = body({ id: 1, name: 'AEGEE-Antenna', code: 'ANT', type: 'antenna' });
const UTRECHT = body({ id: 3, name: 'AEGEE-Utrecht', code: 'UTR', type: 'antenna' });
const ZAGREB = body({ id: 5, name: 'AEGEE-Zagreb', code: 'ZAG', type: 'contact antenna' });
const WORKING_GROUP = body({ id: 4, name: 'IT Working Group', code: 'ITW', type: 'working group' });

// The board of body 1 during the submission period (local:manage_memberslist:agora).
const BOARD = statutoryEventPermissions({
    see_memberslist: { global: false, 1: true },
    upload_memberslist: { global: false, 1: true },
    edit_memberslist: { global: false, 1: true }
});
// The Network Director (global:manage_memberslist:agora), who is in no board.
const ND = statutoryEventPermissions({
    see_memberslist: { global: true },
    upload_memberslist: { global: true },
    edit_memberslist: { global: true }
});
// The board of body 1 after the deadlines: it may still see its list.
const LATE_BOARD = statutoryEventPermissions({
    see_memberslist: { global: false, 1: true },
    upload_memberslist: { global: false, 1: false },
    edit_memberslist: { global: false, 1: false }
});

const NOW = Date.parse(FIXED_NOW);
// An Agora whose members list deadlines are `submission` and `edit` days from FIXED_NOW (the
// edit deadline is two weeks before the start).
const agora = (permissions: StatutoryEventPermissions, { submission = 21, edit = 27 }: { submission?: number | null; edit?: number } = {}): StatutoryEvent => statutoryEvent({
    url: 'agora-spring',
    memberslist_submission_deadline: submission === null ? null : iso(submission, NOW),
    starts: iso(edit + 14, NOW),
    ends: iso(edit + 18, NOW),
    permissions
}, { now: NOW });

const ALEX = bodyMembership({ user_id: 2, body_id: 1, user: { ...bodyMembership({ user_id: 2 }).user, first_name: 'Alex', last_name: 'Member' } });
const JAN = bodyMembership({ user_id: 7, body_id: 1, user: { ...bodyMembership({ user_id: 7 }).user, first_name: 'Jan', last_name: 'Jansen' } });

// Alex paid 30 euro this year; Jan's payment has expired. Core stores the currency with the
// keys the frontend's currency list has (`EU` for the euro).
const ALEX_PAID = payment({ user_id: 2, body_id: 1, amount: 30, currency: 'EU', starts: date(-60, NOW), expires: date(300, NOW) });
const JAN_EXPIRED = payment({ user_id: 7, body_id: 1, amount: 25, currency: 'EU', starts: date(-400, NOW), expires: date(-35, NOW) });

const STORED = membersList({
    body_id: 1,
    members: [
        membersListMember({ user_id: 2, first_name: 'Alex', last_name: 'Member', fee: 40 }),
        membersListMember({ user_id: null, first_name: 'Old', last_name: 'Member', fee: 20 })
    ]
});

interface Page_ {
    event?: StatutoryEvent;
    list?: MembersList | null;
    bodies?: typeof ANTENNA[];
}

// The page of the board of body 1, with its list stored or not (404).
const mockPage = (api: ApiMock, { event = agora(BOARD), list = null }: Page_ = {}): void => {
    api.json('GET statutory /events/:id', ok(event));
    api.on('GET core /bodies/:id', ({ params }) => ({ json: ok([ANTENNA, UTRECHT, ZAGREB, WORKING_GROUP].find((item) => String(item.id) === params.id)) }));
    if (list) api.json('GET statutory /events/:id/memberslists/:body_id', ok(list));
    else api.on('GET statutory /events/:id/memberslists/:body_id', { status: 404, json: notFound('Members list is not found.') });
};

const mockCore = (api: ApiMock, members: BodyMembership[] = [ALEX, JAN], payments: Payment[] = [ALEX_PAID, JAN_EXPIRED]): void => {
    api.json('GET core /bodies/:id/members', ok(members));
    api.json('GET core /bodies/:id/payments', ok(payments));
};

const members = (page: Page) => page.getByRole('table', { name: 'Members' });
const rowOf = (page: Page, text: string) => tableRows(members(page)).filter({ hasText: text });
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const saveCalls = (api: ApiMock) => api.callsTo('POST statutory /events/:id/memberslists/:body_id');
const fetchFromBody = async (page: Page): Promise<void> => {
    await button(page, 'Fetch members list from a body').click();
    await expect(tableRows(members(page)).first()).toBeVisible();
};

test.describe('sending the members list of a local', () => {
    // The deadlines and the payments are dated from FIXED_NOW.
    test.beforeEach(async ({ page }) => {
        await freezeTime(page);
    });

    test('a board member sees their antenna, which hasn\'t sent a list yet', async ({ page, api }) => {
        mockPage(api);
        await page.goto('/statutory/agora-spring/memberslist/upload');

        await expect(page.getByRole('heading', { name: 'Manage members list' })).toBeVisible();
        await expect(page).toHaveTitle('MyAEGEE | Upload members list');
        await expect(page.getByLabel('Select the body to manage members list for:')).toHaveValue('1');
        await expect(page.getByLabel('Select the body to manage members list for:').getByRole('option')).toHaveText(['AEGEE-Antenna']);
        await expect(page.getByText('This local hasn\'t submitted a members list for this event yet.')).toBeVisible();

        // Without a list there is nothing to edit or save yet.
        await expect(button(page, 'Fetch members list from a body')).toBeVisible();
        await expect(button(page, 'Edit')).toHaveCount(0);
        await expect(button(page, 'Save!')).toHaveCount(0);
        await expect(page.getByRole('table', { name: 'Members' })).toHaveCount(0);

        expect(api.callsTo('GET core /bodies/:id').map((call) => call.params)).toEqual([{ id: '1' }]);
        expect(api.callsTo('GET statutory /events/:id/memberslists/:body_id').map((call) => call.params)).toEqual([{ id: 'agora-spring', body_id: '1' }]);
    });

    test('only locals are offered', async ({ page, api }) => {
        mockPage(api, { event: agora(statutoryEventPermissions({ ...BOARD, see_memberslist: { global: false, 1: true, 4: true, 5: true } })) });
        await page.goto('/statutory/agora-spring/memberslist/upload');

        await expect.poll(() => api.callsTo('GET core /bodies/:id').length).toBe(3);
        await expect(page.getByLabel('Select the body to manage members list for:').getByRole('option')).toHaveText(['AEGEE-Antenna', 'AEGEE-Zagreb']);
    });

    test('a member without a local to manage is told so', async ({ page, api }) => {
        api.json('GET statutory /events/:id', ok(agora(statutoryEventPermissions())));
        await page.goto('/statutory/agora-spring/memberslist/upload');

        await expect(page.getByText('You are not a board member of any body.')).toBeVisible();
        await expect(page.getByLabel('Select the body to manage members list for:')).toHaveCount(0);
        await expect(button(page, 'Fetch members list from a body')).toHaveCount(0);
    });

    test('the page doesn\'t say there is no local while the locals load', async ({ page, api }) => {
        mockPage(api);
        api.on('GET core /bodies/:id', { json: ok(ANTENNA), delayMs: 1000 });
        await page.goto('/statutory/agora-spring/memberslist/upload');

        // The body is asked for, and its answer takes a second.
        await expect.poll(() => api.callsTo('GET core /bodies/:id').length).toBe(1);
        expect(await page.getByText('You are not a board member of any body.').isVisible()).toBe(false);

        await expect(page.getByLabel('Select the body to manage members list for:')).toHaveValue('1');
        await expect(page.getByText('You are not a board member of any body.')).toHaveCount(0);
    });

    test('locals that can\'t be loaded are said so', async ({ page, api }) => {
        mockPage(api);
        api.on('GET core /bodies/:id', { status: 500, json: { success: false, message: 'Something went wrong on the server.' } });
        await page.goto('/statutory/agora-spring/memberslist/upload');

        await expect(toast(page, 'Could not fetch bodies: Something went wrong on the server.')).toBeVisible();
    });

    test('the Network Director picks any local', async ({ page, api }) => {
        api.json('GET statutory /events/:id', ok(agora(ND)));
        api.json('GET core /bodies', ok([ANTENNA, UTRECHT, WORKING_GROUP]));
        api.json('GET statutory /events/:id/memberslists/:body_id', ok(membersList({ body_id: 3 })));
        await page.goto('/statutory/agora-spring/memberslist/upload');

        await expect(page.getByText('You haven\'t selected the antenna yet.')).toBeVisible();
        await expect(page.getByLabel('Select the body to manage members list for:').getByRole('option')).toHaveText(['AEGEE-Antenna', 'AEGEE-Utrecht']);

        await page.getByLabel('Select the body to manage members list for:').selectOption('AEGEE-Utrecht');

        await expect(page.getByText('Total members: 2')).toBeVisible();
        await expect(page.getByText('You haven\'t selected the antenna yet.')).toHaveCount(0);
        expect(api.callsTo('GET statutory /events/:id/memberslists/:body_id').map((call) => call.params.body_id)).toEqual(['3']);
        // With the global permission the list can be changed.
        await expect(button(page, 'Edit')).toBeVisible();
        await expect(button(page, 'Save!')).toBeVisible();
    });

    test('locals that can\'t be loaded for the Network Director are said so', async ({ page, api }) => {
        api.json('GET statutory /events/:id', ok(agora(ND)));
        api.on('GET core /bodies', { status: 500, json: { success: false, message: 'Something went wrong on the server.' } });
        await page.goto('/statutory/agora-spring/memberslist/upload');

        await expect(toast(page, 'Could not fetch bodies: Something went wrong on the server.')).toBeVisible();
    });

    test('the members come from core with their current fees, and the list is saved', async ({ page, api }) => {
        mockPage(api);
        mockCore(api);
        const saved = membersList({
            body_id: 1,
            members: [
                membersListMember({ user_id: 2, first_name: 'Alex', last_name: 'Member', fee: 30 }),
                membersListMember({ user_id: 7, first_name: 'Jan', last_name: 'Jansen', fee: 0 })
            ]
        });
        api.json('POST statutory /events/:id/memberslists/:body_id', ok(saved));
        await page.goto('/statutory/agora-spring/memberslist/upload');

        await fetchFromBody(page);

        // Alex's payment is current, Jan's has expired.
        await expect(tableRows(members(page))).toHaveCount(2);
        const alex = rowOf(page, 'Alex');
        await expect(await cellOf(members(page), alex, 'Index')).toHaveText('1');
        await expect(await cellOf(members(page), alex, 'User ID')).toHaveText('2');
        await expect(await cellOf(members(page), alex, 'First name')).toHaveText('Alex');
        await expect(await cellOf(members(page), alex, 'Last name')).toHaveText('Member');
        await expect(await cellOf(members(page), alex, 'Fee')).toHaveText('30');
        await expect(await cellOf(members(page), rowOf(page, 'Jan'), 'Fee')).toHaveText('0');
        // A list from core has no fee to AEGEE-Europe yet: no such column, and no such cell.
        await expect(alex.getByRole('cell')).toHaveCount(5);
        await expect(page.getByText('Total members: 2')).toBeVisible();
        expect(api.callsTo('GET core /bodies/:id/members').map((call) => call.params)).toEqual([{ id: '1' }]);
        expect(api.callsTo('GET core /bodies/:id/payments').map((call) => call.params)).toEqual([{ id: '1' }]);

        await page.getByLabel('Currency').selectOption('Euro');
        await button(page, 'Save!').click();

        await expect(toast(page, 'Members list is uploaded.')).toBeVisible();
        expect(saveCalls(api).map((call) => [call.params, call.body])).toEqual([[{ id: 'agora-spring', body_id: '1' }, {
            currency: 'EU',
            members: [
                { user_id: 2, first_name: 'Alex', last_name: 'Member', fee: 30 },
                { user_id: 7, first_name: 'Jan', last_name: 'Jansen', fee: 0 }
            ]
        }]]);
        // What statutory computed comes back with the list.
        await expect(page.getByText('Total fee paid to AEGEE-Europe: 5.75 EUR')).toBeVisible();
        await expect(await cellOf(members(page), rowOf(page, 'Alex'), 'Fee to AEGEE-Europe')).toHaveText('3.75 EUR');
        await expect(await cellOf(members(page), rowOf(page, 'Jan'), 'Fee to AEGEE-Europe')).toHaveText('2.00 EUR');
    });

    test('the currency of the members\' payments becomes the currency of the list', async ({ page, api }) => {
        mockPage(api);
        mockCore(api, [ALEX, JAN], [{ ...ALEX_PAID, currency: 'PL' }, JAN_EXPIRED]);
        await page.goto('/statutory/agora-spring/memberslist/upload');

        await fetchFromBody(page);

        await expect(page.getByLabel('Currency')).toHaveValue('PL');
        await expect(await cellOf(members(page), rowOf(page, 'Alex'), 'Fee')).toHaveText('30');
        await expect(page.getByText(/in another currency/)).toHaveCount(0);
    });

    test('with payments in several currencies only those in the list\'s currency fill in a fee', async ({ page, api }) => {
        mockPage(api);
        const JAN_PAID = payment({ user_id: 7, body_id: 1, amount: 120, currency: 'PL', starts: date(-30, NOW), expires: date(300, NOW) });
        mockCore(api, [ALEX, JAN], [ALEX_PAID, JAN_PAID]);
        await page.goto('/statutory/agora-spring/memberslist/upload');

        await fetchFromBody(page);

        // No currency is chosen yet: no fee is filled in, and the page says why.
        await expect(page.getByLabel('Currency')).toHaveValue('');
        await expect(await cellOf(members(page), rowOf(page, 'Alex'), 'Fee')).toHaveText('0');
        await expect(await cellOf(members(page), rowOf(page, 'Jan'), 'Fee')).toHaveText('0');
        await expect(page.getByText('Some payments are in another currency (Euro, Zloty (PL)): their fees are not filled in, check them.')).toBeVisible();

        await page.getByLabel('Currency').selectOption('Euro');
        await expect(await cellOf(members(page), rowOf(page, 'Alex'), 'Fee')).toHaveText('30');
        await expect(await cellOf(members(page), rowOf(page, 'Jan'), 'Fee')).toHaveText('0');
        await expect(page.getByText('Some payments are in another currency (Zloty (PL)): their fees are not filled in, check them.')).toBeVisible();

        // Another currency takes back the fees it doesn't match.
        await page.getByLabel('Currency').selectOption('Zloty (PL)');
        await expect(await cellOf(members(page), rowOf(page, 'Alex'), 'Fee')).toHaveText('0');
        await expect(await cellOf(members(page), rowOf(page, 'Jan'), 'Fee')).toHaveText('120');
        await expect(page.getByText('Some payments are in another currency (Euro): their fees are not filled in, check them.')).toBeVisible();
    });

    test('a quickly switched local shows the list of that local, not of the one before', async ({ page, api }) => {
        const twoBoards = statutoryEventPermissions({
            see_memberslist: { global: false, 1: true, 3: true },
            upload_memberslist: { global: false, 1: true, 3: true },
            edit_memberslist: { global: false, 1: true, 3: true }
        });
        mockPage(api, { event: agora(twoBoards) });
        // The antenna's list (asked for on load) is held back until Utrecht's is shown.
        let release = (): void => undefined;
        const released = new Promise<void>((resolve) => { release = resolve; });
        api.on('GET statutory /events/:id/memberslists/:body_id', async ({ params }) => {
            if (params.body_id !== '1') return { json: ok(membersList({ body_id: 3, members: [membersListMember({ user_id: 7, first_name: 'Jan', last_name: 'Jansen', fee: 25 })] })) };
            await released;
            return { json: ok(STORED) };
        });
        const late = page.waitForResponse((response) => response.url().endsWith('/memberslists/1'));
        await page.goto('/statutory/agora-spring/memberslist/upload');

        await page.getByLabel('Select the body to manage members list for:').selectOption('AEGEE-Utrecht');
        await expect(page.getByText('Total members: 1')).toBeVisible();
        release();
        await (await late).finished();
        // Lets the page handle the answer it has just received (two turns of its event loop), so that what is checked below is after it
        await page.evaluate(() => new Promise((resolve) => { setTimeout(() => setTimeout(resolve, 0), 0); }));

        await expect(page.getByText('Total members: 1')).toBeVisible();
        await expect(tableRows(members(page))).toHaveText([/Jansen/]);
    });

    test('a payment whose amount is no number counts as no fee', async ({ page, api }) => {
        mockPage(api);
        // Core sends numbers; this is a defence against anything else.
        mockCore(api, [ALEX], [payment({ ...ALEX_PAID, amount: 'n/a' as unknown as number })]);
        await page.goto('/statutory/agora-spring/memberslist/upload');

        await fetchFromBody(page);

        await expect(await cellOf(members(page), rowOf(page, 'Alex'), 'Fee')).toHaveText('0');
    });

    test('payments that can\'t be loaded leave the fees empty, with a warning', async ({ page, api }) => {
        mockPage(api);
        api.json('GET core /bodies/:id/members', ok([ALEX, JAN]));
        api.on('GET core /bodies/:id/payments', { status: 403, json: forbidden('Permission view:payment is required, but not present.') });
        await page.goto('/statutory/agora-spring/memberslist/upload');

        await fetchFromBody(page);

        await expect(toast(page, 'Could not fetch payments info: Request failed with status code 403')).toBeVisible();
        await expect(tableRows(members(page))).toHaveCount(2);
        await expect(await cellOf(members(page), rowOf(page, 'Alex'), 'Fee')).toHaveText('0');
    });

    test('members that can\'t be loaded are said so', async ({ page, api }) => {
        mockPage(api);
        api.on('GET core /bodies/:id/members', { status: 403, json: forbidden('Permission view_members:body is required, but not present.') });
        await page.goto('/statutory/agora-spring/memberslist/upload');

        await button(page, 'Fetch members list from a body').click();

        await expect(toast(page, 'Some error happened: Permission view_members:body is required, but not present.')).toBeVisible();
        await expect(page.getByText('This local hasn\'t submitted a members list for this event yet.')).toBeVisible();
    });

    test('a stored list is shown with its sums', async ({ page, api }) => {
        mockPage(api, { list: STORED });
        await page.goto('/statutory/agora-spring/memberslist/upload');

        await expect(page.getByText('Total members: 2')).toBeVisible();
        await expect(page.getByText('Total fee paid to AEGEE-Europe: 6.75 EUR')).toBeVisible();
        await expect(page.getByLabel('Currency')).toHaveValue('EU');
        await expect(page.getByText('This local hasn\'t submitted a members list for this event yet.')).toHaveCount(0);

        const alex = rowOf(page, 'Alex');
        await expect(alex.getByRole('link', { name: '2' })).toHaveAttribute('href', '/members/2');
        await expect(alex.getByRole('link', { name: '2' })).toHaveAttribute('target', '_blank');
        await expect(await cellOf(members(page), alex, 'Fee')).toHaveText('40');
        await expect(await cellOf(members(page), alex, 'Fee to AEGEE-Europe')).toHaveText('4.25 EUR');
        // A member of a list of old has no user.
        await expect(await cellOf(members(page), rowOf(page, 'Old'), 'User ID')).toHaveText('-');
        await expect(button(page, 'Edit')).toBeVisible();
        await expect(button(page, 'Save!')).toBeEnabled();
    });

    test('the list is edited by hand, with one fee for everyone', async ({ page, api }) => {
        mockPage(api, { list: STORED });
        await page.goto('/statutory/agora-spring/memberslist/upload');

        await button(page, 'Edit').click();

        await expect(page.getByText('Total members: 2')).toHaveCount(0);
        await expect(page.getByRole('textbox', { name: 'First name of member 1' })).toHaveValue('Alex');
        await expect(page.getByRole('textbox', { name: 'Last name of member 2' })).toHaveValue('Member');
        await expect(page.getByRole('spinbutton', { name: 'Fee of member 2' })).toHaveValue('20');

        await page.getByLabel('Set fee for everyone').fill('25');
        await button(page, 'Set').click();
        await expect(page.getByRole('spinbutton', { name: 'Fee of member 1' })).toHaveValue('25');
        await expect(page.getByRole('spinbutton', { name: 'Fee of member 2' })).toHaveValue('25');
        await page.getByRole('textbox', { name: 'First name of member 2' }).fill('Older');

        await button(page, 'Stop editing').click();

        await expect(page.getByRole('textbox', { name: 'First name of member 1' })).toHaveCount(0);
        await expect(page.getByLabel('Set fee for everyone')).toHaveCount(0);
        await expect(await cellOf(members(page), rowOf(page, 'Older'), 'Fee')).toHaveText('25');
        await expect(button(page, 'Edit')).toBeVisible();
    });

    test('a changed list is saved with what was changed', async ({ page, api }) => {
        mockPage(api, { list: STORED });
        api.json('POST statutory /events/:id/memberslists/:body_id', ok(STORED));
        await page.goto('/statutory/agora-spring/memberslist/upload');

        await button(page, 'Edit').click();
        await page.getByRole('spinbutton', { name: 'Fee of member 2' }).fill('22');
        await page.getByLabel('Currency').selectOption('Swiss Franc (CH)');
        await button(page, 'Save!').click();

        await expect(toast(page, 'Members list is uploaded.')).toBeVisible();
        expect(saveCalls(api).map((call) => call.body)).toEqual([{
            currency: 'CH',
            members: [
                { user_id: 2, first_name: 'Alex', last_name: 'Member', fee: 40 },
                { user_id: null, first_name: 'Old', last_name: 'Member', fee: 22 }
            ]
        }]);
        // Saving ends the editing.
        await expect(page.getByRole('spinbutton', { name: 'Fee of member 2' })).toHaveCount(0);
    });

    test('a board that may only edit its own list gets the buttons', async ({ page, api }) => {
        mockPage(api, { list: STORED, event: agora(statutoryEventPermissions({ see_memberslist: { global: false, 1: true }, edit_memberslist: { global: false, 1: true } })) });
        await page.goto('/statutory/agora-spring/memberslist/upload');

        await expect(button(page, 'Edit')).toBeVisible();
        await expect(button(page, 'Save!')).toBeVisible();
    });

    test('the global permission to upload is enough to fetch a list for a local', async ({ page, api }) => {
        mockPage(api, { event: agora(statutoryEventPermissions({ see_memberslist: { global: false, 1: true }, upload_memberslist: { global: true } })) });
        await page.goto('/statutory/agora-spring/memberslist/upload');

        await expect(button(page, 'Fetch members list from a body')).toBeVisible();
    });

    test('a stored list that can\'t be changed after the submission deadline says whom to ask', async ({ page, api }) => {
        mockPage(api, { list: STORED, event: agora(LATE_BOARD, { submission: -2, edit: 5 }) });
        await page.goto('/statutory/agora-spring/memberslist/upload');

        await expect(page.getByText('The upload deadline has passed. If you want to make changes to the members list, reach out to the Network Director at network@aegee.eu.')).toBeVisible();
        await expect(page.getByRole('link', { name: 'network@aegee.eu' })).toHaveAttribute('href', 'mailto:network@aegee.eu');
        await expect(page.getByText('Total members: 2')).toBeVisible();
        await expect(button(page, 'Edit')).toHaveCount(0);
        await expect(button(page, 'Save!')).toHaveCount(0);
    });

    test('a stored list that can\'t be changed after the edit deadline says whom to ask', async ({ page, api }) => {
        mockPage(api, { list: STORED, event: agora(LATE_BOARD, { submission: -10, edit: -2 }) });
        await page.goto('/statutory/agora-spring/memberslist/upload');

        await expect(page.getByText('The edit deadline has passed. If you want to make changes to the members list, reach out to the Network Director at network@aegee.eu.')).toBeVisible();
        await expect(page.getByText(/The upload deadline has passed/)).toHaveCount(0);
        await expect(button(page, 'Edit')).toHaveCount(0);
    });

    test('a local without a list after the submission deadline is told whom to ask', async ({ page, api }) => {
        mockPage(api, { event: agora(LATE_BOARD, { submission: -2, edit: 5 }) });
        await page.goto('/statutory/agora-spring/memberslist/upload');

        await expect(page.getByText('The submission deadline has passed. If your local still needs to submit a members list, reach out to the Network Director at network@aegee.eu.')).toBeVisible();
        await expect(page.getByText('This local hasn\'t submitted a members list for this event yet.')).toBeVisible();
        await expect(button(page, 'Fetch members list from a body')).toHaveCount(0);
    });

    test('a local without a list after the edit deadline is told whom to ask', async ({ page, api }) => {
        mockPage(api, { event: agora(LATE_BOARD, { submission: -10, edit: -2 }) });
        await page.goto('/statutory/agora-spring/memberslist/upload');

        await expect(page.getByText(/The submission deadline has passed\./)).toBeVisible();
        await expect(page.getByText('This local hasn\'t submitted a members list for this event yet.')).toBeVisible();
    });

    test('who may still send a list after the submission deadline isn\'t told it has passed', async ({ page, api }) => {
        mockPage(api, { event: agora(BOARD, { submission: -2, edit: 5 }) });
        await page.goto('/statutory/agora-spring/memberslist/upload');

        await expect(button(page, 'Fetch members list from a body')).toBeVisible();
        await expect(page.getByText('This local hasn\'t submitted a members list for this event yet.')).toBeVisible();
        await expect(page.getByText(/deadline has passed/)).toHaveCount(0);
    });

    test('before the submission deadline nothing is said about deadlines', async ({ page, api }) => {
        mockPage(api, { list: STORED, event: agora(LATE_BOARD, { submission: 3, edit: 10 }) });
        await page.goto('/statutory/agora-spring/memberslist/upload');

        await expect(page.getByText('Total members: 2')).toBeVisible();
        await expect(page.getByText(/deadline has passed/)).toHaveCount(0);
    });

    test('an event without a submission deadline says nothing about deadlines', async ({ page, api }) => {
        mockPage(api, { event: agora(LATE_BOARD, { submission: null, edit: -2 }) });
        await page.goto('/statutory/agora-spring/memberslist/upload');

        await expect(page.getByText('This local hasn\'t submitted a members list for this event yet.')).toBeVisible();
        await expect(page.getByText(/deadline has passed/)).toHaveCount(0);
    });

    test('a list without any fee is only saved once that is confirmed', async ({ page, api }) => {
        mockPage(api);
        mockCore(api, [ALEX, JAN], []);
        api.json('POST statutory /events/:id/memberslists/:body_id', ok(membersList({ body_id: 1 })));
        await page.goto('/statutory/agora-spring/memberslist/upload');
        await fetchFromBody(page);
        await page.getByLabel('Currency').selectOption('Euro');

        await button(page, 'Save!').click();
        const noFee = dialog(page, 'No fee set');
        await expect(noFee).toContainText('You submitted that your members have paid a fee of €0 to your local, is that correct?');
        await noFee.getByRole('button', { name: 'Cancel' }).click();
        await expect(noFee).toHaveCount(0);
        expect(saveCalls(api)).toEqual([]);

        await button(page, 'Save!').click();
        await dialog(page, 'No fee set').getByRole('button', { name: 'Confirm' }).click();

        await expect(toast(page, 'Members list is uploaded.')).toBeVisible();
        expect(saveCalls(api).map((call) => (call.body as { members: { fee: number }[] }).members.map((member) => member.fee))).toEqual([[0, 0]]);
    });

    test('a list without a currency isn\'t sent', async ({ page, api }) => {
        mockPage(api);
        // Without a current payment nothing sets the currency.
        mockCore(api, [ALEX], []);
        await page.goto('/statutory/agora-spring/memberslist/upload');
        await fetchFromBody(page);
        await button(page, 'Edit').click();
        await page.getByLabel('Fee of member 1').fill('30');

        await button(page, 'Save!').click();

        await expect(toast(page, 'Please select a currency.')).toBeVisible();
        expect(saveCalls(api)).toEqual([]);
    });

    test('a local without members has no list to send', async ({ page, api }) => {
        mockPage(api);
        mockCore(api, [], []);
        await page.goto('/statutory/agora-spring/memberslist/upload');
        await button(page, 'Fetch members list from a body').click();
        await expect(page.getByText('Total members: 0')).toBeVisible();
        await page.getByLabel('Currency').selectOption('Euro');

        await button(page, 'Save!').click();
        await dialog(page, 'No fee set').getByRole('button', { name: 'Confirm' }).click();

        await expect(toast(page, 'Memberslist should contain at least 1 member.')).toBeVisible();
        expect(saveCalls(api)).toEqual([]);
    });

    const invalid: [string, (page: Page) => Promise<void>, string][] = [
        ['a fee that was cleared', (page) => page.getByRole('spinbutton', { name: 'Fee of member 2' }).fill(''), 'Please set the fee for member number 2.'],
        ['a negative fee', (page) => page.getByRole('spinbutton', { name: 'Fee of member 2' }).fill('-5'), 'Fee for member number 2 cannot be negative.'],
        ['an empty first name', (page) => page.getByRole('textbox', { name: 'First name of member 1' }).fill('  '), 'First name for member number 1 is not set.'],
        ['an empty last name', (page) => page.getByRole('textbox', { name: 'Last name of member 2' }).fill(''), 'Last name for member number 2 is not set.']
    ];
    for (const [what, change, message] of invalid) {
        test(`a list with ${what} isn't sent`, async ({ page, api }) => {
            mockPage(api, { list: STORED });
            await page.goto('/statutory/agora-spring/memberslist/upload');
            await button(page, 'Edit').click();

            await change(page);
            await button(page, 'Save!').click();

            await expect(toast(page, message)).toBeVisible();
            expect(saveCalls(api)).toEqual([]);
        });
    }

    test('saving can\'t be started twice', async ({ page, api }) => {
        mockPage(api, { list: STORED });
        api.on('POST statutory /events/:id/memberslists/:body_id', { json: ok(STORED), delayMs: 1000 });
        await page.goto('/statutory/agora-spring/memberslist/upload');

        await button(page, 'Save!').click();

        await expect(button(page, 'Save!')).toBeDisabled();
        await expect(toast(page, 'Members list is uploaded.')).toBeVisible();
        await expect(button(page, 'Save!')).toBeEnabled();
        expect(saveCalls(api)).toHaveLength(1);
    });

    test('a list statutory refuses says why', async ({ page, api }) => {
        mockPage(api, { list: STORED });
        api.on('POST statutory /events/:id/memberslists/:body_id', { status: 422, json: validationError({ currency: ['The currency is not known.'] }) });
        await page.goto('/statutory/agora-spring/memberslist/upload');

        await page.getByLabel('Currency').selectOption('Lek (AL)');
        await button(page, 'Save!').click();

        await expect(toast(page, 'Could not save memberslist: The currency is not known.')).toBeVisible();
        await expect(button(page, 'Save!')).toBeEnabled();
    });

    test('a list that may not be changed says why', async ({ page, api }) => {
        mockPage(api, { list: STORED });
        api.on('POST statutory /events/:id/memberslists/:body_id', { status: 403, json: forbidden('You are not allowed to edit memberslist.') });
        await page.goto('/statutory/agora-spring/memberslist/upload');

        await button(page, 'Save!').click();

        await expect(toast(page, 'Could not save memberslist: You are not allowed to edit memberslist.')).toBeVisible();
    });

    test('a list that can\'t be loaded is said so', async ({ page, api }) => {
        mockPage(api);
        api.on('GET statutory /events/:id/memberslists/:body_id', { status: 403, json: forbidden('You are not allowed to see this memberslist.') });
        await page.goto('/statutory/agora-spring/memberslist/upload');

        await expect(toast(page, 'Could not fetch memberslist: You are not allowed to see this memberslist.')).toBeVisible();
    });

    test('a list that doesn\'t reach the page is taken as not sent, without a message', async ({ page, api }) => {
        mockPage(api);
        api.on('GET statutory /events/:id/memberslists/:body_id', { abort: 'failed' });
        await page.goto('/statutory/agora-spring/memberslist/upload');

        await expect(page.getByText('This local hasn\'t submitted a members list for this event yet.')).toBeVisible();
        await expect(page.getByRole('alert')).toHaveCount(0);
    });

    test('an unknown event goes back to the event page', async ({ page, api }) => {
        api.fallback(mockEverything);
        // The event page that follows finds it.
        let asked = 0;
        api.on('GET statutory /events/:id', () => (asked++ === 0
            ? { status: 404, json: notFound('Event with such url or ID is not found.') }
            : { json: ok(agora(statutoryEventPermissions())) }));
        await page.goto('/statutory/agora-spring/memberslist/upload');

        await expect(toast(page, 'Event is not found')).toBeVisible();
        await expect(page).toHaveURL('/statutory/agora-spring');
    });

    test('an event that can\'t be loaded goes back to the event page', async ({ page, api }) => {
        api.fallback(mockEverything);
        let asked = 0;
        api.on('GET statutory /events/:id', () => (asked++ === 0
            ? { status: 500, json: { success: false, message: 'Internal server error.' } }
            : { json: ok(agora(statutoryEventPermissions())) }));
        await page.goto('/statutory/agora-spring/memberslist/upload');

        await expect(toast(page, 'Some error happened: Internal server error.')).toBeVisible();
        await expect(page).toHaveURL('/statutory/agora-spring');
    });
});
