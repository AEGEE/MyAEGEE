// The members lists the locals sent for an Agora (/statutory/:id/memberslist/list), for the
// Network Director: what each local owes AEGEE-Europe and how much of it is paid, setting the
// fee paid, and the members of one list in a modal (DisplayMembersListModal).
import type { Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { badRequest, forbidden, notFound, ok, validationError } from '../support/factories/base.ts';
import { body, type Body } from '../support/factories/core.ts';
import { statutoryEvent, statutoryEventPermissions, type StatutoryEventPermissions } from '../support/factories/statutory-events.ts';
import { membersList, membersListMember, type MembersList } from '../support/factories/statutory-memberslists.ts';
import { cellOf, dialog, expectEmptyTable, sortBy, tableRows, toast } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { test, expect } from '../support/test.ts';

// The Network Director (global:see_memberslists:agora and global:set_memberslists_fee_paid:agora).
const ND = statutoryEventPermissions({ see_memberslist: { global: true }, set_memberslists_fee_paid: true });
// Who may see the lists but not set what is paid (global:see_memberslists:agora only).
const VIEWER = statutoryEventPermissions({ see_memberslist: { global: true } });

const ANTENNA = body({ id: 1, name: 'AEGEE-Antenna', code: 'ANT' });
const UTRECHT = body({ id: 3, name: 'AEGEE-Utrecht', code: 'UTR' });

// Two members who paid 40 and 20 euro: 6.75 euro to AEGEE-Europe, 2.25 of it paid.
const ANTENNA_LIST = membersList({ id: 20, body_id: 1, fee_paid: 2.25, updated_at: '2027-02-20T14:30:00.000Z' });
// Three members in Swiss francs, one of them from a list of old without a user.
const UTRECHT_LIST = membersList({
    id: 21,
    body_id: 3,
    currency: 'CH',
    conversion_rate: 1.25,
    members: [
        membersListMember({ user_id: 7, first_name: 'Jan', last_name: 'Jansen', fee: 50 }, 1.25),
        membersListMember({ user_id: 8, first_name: 'Pim', last_name: 'de Vries', fee: 50 }, 1.25),
        membersListMember({ user_id: null, first_name: 'Old', last_name: 'Member', fee: 25 }, 1.25)
    ],
    updated_at: '2027-02-25T08:00:00.000Z'
});

interface Lists {
    lists?: MembersList[];
    bodies?: Body[];
    permissions?: StatutoryEventPermissions;
}

const mockPage = (api: ApiMock, { lists = [ANTENNA_LIST, UTRECHT_LIST], bodies = [ANTENNA, UTRECHT], permissions = ND }: Lists = {}): void => {
    api.json('GET statutory /events/:id', ok(statutoryEvent({ url: 'agora-spring', permissions })));
    api.json('GET statutory /events/:id/memberslists', ok(lists));
    api.json('GET core /bodies', ok(bodies));
};

const table = (page: Page) => page.getByRole('region', { name: 'Members lists' }).getByRole('table');
const rowOf = (page: Page, name: string) => tableRows(table(page)).filter({ hasText: name });
const feePaidPrompt = (page: Page) => dialog(page, 'Set fee paid');
const askFeePaid = async (page: Page, name: string): Promise<void> => {
    await page.getByRole('button', { name: `Set fee paid of ${name}` }).click();
    await expect(feePaidPrompt(page)).toBeVisible();
};
const feePaidCalls = (api: ApiMock) => api.callsTo('PUT statutory /events/:id/memberslists/:body_id/fee_paid');

test.describe('the members lists of an Agora', () => {
    test('lists what each local sent, owes and paid', async ({ page, api }) => {
        mockPage(api);
        await page.goto('/statutory/agora-spring/memberslist/list');

        await expect(page.getByRole('heading', { name: 'List all memberslists for Agora Spring' })).toBeVisible();
        await expect(page).toHaveTitle('MyAEGEE | List members lists');
        await expect(tableRows(table(page))).toHaveCount(2);

        const antenna = rowOf(page, 'AEGEE-Antenna');
        await expect(await cellOf(table(page), antenna, 'Body name')).toHaveText('AEGEE-Antenna');
        await expect(antenna.getByRole('link', { name: 'AEGEE-Antenna' })).toHaveAttribute('href', '/bodies/1');
        await expect(await cellOf(table(page), antenna, 'Currency')).toHaveText('EU');
        await expect(await cellOf(table(page), antenna, 'Members amount')).toHaveText('2');
        await expect(await cellOf(table(page), antenna, 'Last updated at')).toHaveText('2027-02-20 15:30');
        await expect(await cellOf(table(page), antenna, 'Fee to AEGEE-Europe')).toHaveText('6.75 EUR');
        await expect(await cellOf(table(page), antenna, 'Fee paid')).toHaveText('2.25 EUR');
        await expect(await cellOf(table(page), antenna, 'Fee not paid')).toHaveText('4.50 EUR');

        // 50 francs are 40 euro: 4.25 euro to AEGEE-Europe; 25 francs are 20 euro: 2.50 euro.
        const utrecht = rowOf(page, 'AEGEE-Utrecht');
        await expect(await cellOf(table(page), utrecht, 'Currency')).toHaveText('CH');
        await expect(await cellOf(table(page), utrecht, 'Members amount')).toHaveText('3');
        await expect(await cellOf(table(page), utrecht, 'Fee to AEGEE-Europe')).toHaveText('11.00 EUR');
        await expect(await cellOf(table(page), utrecht, 'Fee not paid')).toHaveText('11.00 EUR');

        expect(api.callsTo('GET statutory /events/:id/memberslists').map((call) => call.params)).toEqual([{ id: 'agora-spring' }]);
    });

    test('a local whose body core doesn\'t list any more is shown by its id', async ({ page, api }) => {
        mockPage(api, { lists: [membersList({ body_id: 9 })], bodies: [ANTENNA] });
        await page.goto('/statutory/agora-spring/memberslist/list');

        const row = rowOf(page, 'Unknown body (#9)');
        await expect(row.getByRole('link', { name: 'Unknown body (#9)' })).toHaveAttribute('href', '/bodies/9');
        await expect(await cellOf(table(page), row, 'Fee to AEGEE-Europe')).toHaveText('6.75 EUR');
        await expect(page.getByRole('button', { name: 'View memberslist of Unknown body (#9)' })).toBeVisible();
    });

    test('the lists can be sorted by the name of the local', async ({ page, api, layout }) => {
        mockPage(api, { lists: [UTRECHT_LIST, ANTENNA_LIST] });
        await page.goto('/statutory/agora-spring/memberslist/list');
        await expect(tableRows(table(page)).nth(0)).toContainText('AEGEE-Utrecht');

        await sortBy(table(page), 'Body name', layout);

        await expect(tableRows(table(page)).nth(0)).toContainText('AEGEE-Antenna');
        await expect(tableRows(table(page)).nth(1)).toContainText('AEGEE-Utrecht');
    });

    test('the sort control doesn\'t offer the column of the buttons', { tag: '@phone-only' }, async ({ page, api }) => {
        mockPage(api);
        await page.goto('/statutory/agora-spring/memberslist/list');

        const sortControl = page.getByRole('combobox').filter({ has: page.getByRole('option', { name: 'Body name', exact: true }) });
        await expect(sortControl.getByRole('option', { name: 'Fee not paid', exact: true })).toHaveCount(1);
        await expect(sortControl.getByRole('option', { name: 'Set fee paid', exact: true })).toHaveCount(0);
    });

    test('an Agora without members lists says so', async ({ page, api }) => {
        mockPage(api, { lists: [] });
        await page.goto('/statutory/agora-spring/memberslist/list');

        await expect.poll(() => api.callsTo('GET core /bodies').length).toBe(1);
        await expectEmptyTable(table(page));
    });

    test('the table says it is loading while the lists come', async ({ page, api }) => {
        api.json('GET statutory /events/:id', ok(statutoryEvent({ url: 'agora-spring', permissions: ND })));
        api.on('GET statutory /events/:id/memberslists', { json: ok([ANTENNA_LIST]), delayMs: 1000 });
        api.json('GET core /bodies', ok([ANTENNA]));
        await page.goto('/statutory/agora-spring/memberslist/list');

        await expect(page.getByRole('region', { name: 'Members lists' })).toHaveAttribute('aria-busy', 'true');
        await expect(page.getByRole('region', { name: 'Members lists' })).toHaveAttribute('aria-busy', 'false');
        await expect(tableRows(table(page))).toHaveCount(1);
    });

    test('who may not set the fee paid has no buttons for it', async ({ page, api }) => {
        mockPage(api, { permissions: VIEWER });
        await page.goto('/statutory/agora-spring/memberslist/list');

        await expect(page.getByRole('button', { name: 'View memberslist of AEGEE-Antenna' })).toBeVisible();
        await expect(page.getByRole('button', { name: /^Set fee paid/ })).toHaveCount(0);
    });

    test('the fee paid is set, and what is left to pay follows', async ({ page, api }) => {
        mockPage(api);
        api.json('PUT statutory /events/:id/memberslists/:body_id/fee_paid', ok({ ...ANTENNA_LIST, fee_paid: 6, fee_not_paid: 0.75 }));
        await page.goto('/statutory/agora-spring/memberslist/list');

        await askFeePaid(page, 'AEGEE-Antenna');
        await expect(feePaidPrompt(page)).toContainText('How much of the fee of AEGEE-Antenna to AEGEE-Europe is paid?');
        await feePaidPrompt(page).getByRole('spinbutton', { name: 'Fee paid (in EUR)' }).fill('6');
        await feePaidPrompt(page).getByRole('button', { name: 'OK' }).click();

        await expect(toast(page, 'Fee paid is set.')).toBeVisible();
        expect(feePaidCalls(api).map((call) => [call.params, call.body])).toEqual([[{ id: 'agora-spring', body_id: '1' }, { fee_paid: 6 }]]);
        const antenna = rowOf(page, 'AEGEE-Antenna');
        await expect(await cellOf(table(page), antenna, 'Fee paid')).toHaveText('6.00 EUR');
        await expect(await cellOf(table(page), antenna, 'Fee not paid')).toHaveText('0.75 EUR');
    });

    test('a fee paid in full leaves nothing to pay, never a negative zero', async ({ page, api }) => {
        // The fees of the members add up to a hair under 0.80 euro.
        mockPage(api, { lists: [membersList({ body_id: 1, fee_to_aegee: 0.7 + 0.1 })] });
        api.json('PUT statutory /events/:id/memberslists/:body_id/fee_paid', ok({ ...ANTENNA_LIST, fee_paid: 0.8, fee_not_paid: 0 }));
        await page.goto('/statutory/agora-spring/memberslist/list');
        await expect(await cellOf(table(page), rowOf(page, 'AEGEE-Antenna'), 'Fee to AEGEE-Europe')).toHaveText('0.80 EUR');

        await askFeePaid(page, 'AEGEE-Antenna');
        await feePaidPrompt(page).getByRole('spinbutton', { name: 'Fee paid (in EUR)' }).fill('0.8');
        await feePaidPrompt(page).getByRole('spinbutton', { name: 'Fee paid (in EUR)' }).press('Enter');

        await expect(toast(page, 'Fee paid is set.')).toBeVisible();
        expect(feePaidCalls(api).map((call) => call.body)).toEqual([{ fee_paid: 0.8 }]);
        await expect(await cellOf(table(page), rowOf(page, 'AEGEE-Antenna'), 'Fee not paid')).toHaveText('0.00 EUR');
    });

    test('cancelling the prompt sets nothing', async ({ page, api }) => {
        mockPage(api);
        await page.goto('/statutory/agora-spring/memberslist/list');

        await askFeePaid(page, 'AEGEE-Utrecht');
        await feePaidPrompt(page).getByRole('button', { name: 'Cancel' }).click();

        await expect(feePaidPrompt(page)).toHaveCount(0);
        await expect(await cellOf(table(page), rowOf(page, 'AEGEE-Utrecht'), 'Fee paid')).toHaveText('0.00 EUR');
        expect(feePaidCalls(api)).toEqual([]);
    });

    test('the prompt takes no empty or negative fee', async ({ page, api }) => {
        mockPage(api);
        await page.goto('/statutory/agora-spring/memberslist/list');
        await askFeePaid(page, 'AEGEE-Antenna');
        const input = feePaidPrompt(page).getByRole('spinbutton', { name: 'Fee paid (in EUR)' });

        await feePaidPrompt(page).getByRole('button', { name: 'OK' }).click();
        await expect(feePaidPrompt(page)).toContainText(/Please fill (in|out) this field/);

        await input.fill('-1');
        await feePaidPrompt(page).getByRole('button', { name: 'OK' }).click();
        await expect(feePaidPrompt(page)).toContainText('Value must be greater than or equal to 0.');

        await expect(feePaidPrompt(page)).toBeVisible();
        expect(feePaidCalls(api)).toEqual([]);
    });

    test('a refused fee paid says why, and the row stays as it was', async ({ page, api }) => {
        mockPage(api);
        api.on('PUT statutory /events/:id/memberslists/:body_id/fee_paid', { status: 422, json: validationError({ fee_paid: ['Fee paid should be a number.'] }) });
        await page.goto('/statutory/agora-spring/memberslist/list');

        await askFeePaid(page, 'AEGEE-Antenna');
        await feePaidPrompt(page).getByRole('spinbutton', { name: 'Fee paid (in EUR)' }).fill('3');
        await feePaidPrompt(page).getByRole('button', { name: 'OK' }).click();

        await expect(toast(page, 'Could not set fee paid: Fee paid should be a number.')).toBeVisible();
        await expect(await cellOf(table(page), rowOf(page, 'AEGEE-Antenna'), 'Fee paid')).toHaveText('2.25 EUR');
    });

    test('a fee paid that can\'t be stored says why', async ({ page, api }) => {
        mockPage(api);
        api.on('PUT statutory /events/:id/memberslists/:body_id/fee_paid', { status: 403, json: forbidden('You are not allowed to see this memberslist.') });
        await page.goto('/statutory/agora-spring/memberslist/list');

        await askFeePaid(page, 'AEGEE-Antenna');
        await feePaidPrompt(page).getByRole('spinbutton', { name: 'Fee paid (in EUR)' }).fill('3');
        await feePaidPrompt(page).getByRole('button', { name: 'OK' }).click();

        await expect(toast(page, 'Could not set fee paid: You are not allowed to see this memberslist.')).toBeVisible();
    });

    test('a list is shown with its members and their fees', async ({ page, api }) => {
        mockPage(api);
        await page.goto('/statutory/agora-spring/memberslist/list');

        await page.getByRole('button', { name: 'View memberslist of AEGEE-Utrecht' }).click();

        const modal = dialog(page, 'Display members list');
        await expect(modal).toBeVisible();
        const members = modal.getByRole('table');
        await expect(tableRows(members)).toHaveCount(3);
        const jan = tableRows(members).filter({ hasText: 'Jan' });
        await expect(await cellOf(members, jan, 'User ID')).toHaveText('7');
        await expect(await cellOf(members, jan, 'First name')).toHaveText('Jan');
        await expect(await cellOf(members, jan, 'Last name')).toHaveText('Jansen');
        await expect(await cellOf(members, jan, 'Fee')).toHaveText('50.00 CH');
        await expect(await cellOf(members, jan, 'Fee to AEGEE-Europe')).toHaveText('4.25 EUR');
        // A member of a list of old has no user.
        const old = tableRows(members).filter({ hasText: 'Old' });
        await expect(await cellOf(members, old, 'User ID')).toHaveText('');
        await expect(await cellOf(members, old, 'Fee to AEGEE-Europe')).toHaveText('2.50 EUR');

        await modal.getByRole('button', { name: 'Close' }).click();
        await expect(modal).toHaveCount(0);
    });

    test('a list without members says so in the modal', async ({ page, api }) => {
        mockPage(api, { lists: [membersList({ body_id: 1, members: [] })] });
        await page.goto('/statutory/agora-spring/memberslist/list');

        await page.getByRole('button', { name: 'View memberslist of AEGEE-Antenna' }).click();

        await expectEmptyTable(dialog(page, 'Display members list').getByRole('table'));
    });

    test('someone who may not see the lists is told so', async ({ page, api }) => {
        api.json('GET statutory /events/:id', ok(statutoryEvent({ url: 'agora-spring' })));
        api.on('GET statutory /events/:id/memberslists', { status: 403, json: forbidden('You are not allowed to see memberslists.') });
        await page.goto('/statutory/agora-spring/memberslist/list');

        await expect(toast(page, 'Could not fetch members lists: You are not allowed to see memberslists.')).toBeVisible();
        await expectEmptyTable(table(page));
    });

    test('an event that is no Agora has no members lists', async ({ page, api }) => {
        api.json('GET statutory /events/:id', ok(statutoryEvent({ type: 'epm', url: 'epm-spring', permissions: ND })));
        api.on('GET statutory /events/:id/memberslists', { status: 400, json: badRequest('You can only access memberslist for Agora.') });
        await page.goto('/statutory/epm-spring/memberslist/list');

        await expect(toast(page, 'Could not fetch members lists: You can only access memberslist for Agora.')).toBeVisible();
    });

    test('an unknown event is said so', async ({ page, api }) => {
        api.on('GET statutory /events/:id', { status: 404, json: notFound('Event with such url or ID is not found.') });
        await page.goto('/statutory/nope/memberslist/list');

        await expect(toast(page, 'Could not fetch members lists: Event with such url or ID is not found.')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'List all memberslists for event that is still loading...' })).toBeVisible();
    });

    test('bodies that can\'t be loaded are said so', async ({ page, api }) => {
        mockPage(api);
        api.on('GET core /bodies', { status: 500, json: { success: false, message: 'Database is down' } });
        await page.goto('/statutory/agora-spring/memberslist/list');

        await expect(toast(page, 'Could not fetch members lists: Database is down')).toBeVisible();
    });

    test('a body links to its page', async ({ page, api }) => {
        mockPage(api);
        await page.goto('/statutory/agora-spring/memberslist/list');
        api.fallback(mockEverything);

        await rowOf(page, 'AEGEE-Utrecht').getByRole('link', { name: 'AEGEE-Utrecht' }).click();

        await expect(page).toHaveURL('/bodies/3');
    });
});
