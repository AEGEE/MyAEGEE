// The locals whose members list for an Agora has no member who paid a fee
// (/statutory/:id/memberslist/list/without_fee).
import type { Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { badRequest, forbidden, notFound, ok } from '../support/factories/base.ts';
import { statutoryEvent, statutoryEventPermissions } from '../support/factories/statutory-events.ts';
import { membersListBody, type MembersListBody } from '../support/factories/statutory-memberslists.ts';
import { cellOf, expectEmptyTable, sortBy, tableRows, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

// Who may see them (global:see_memberslists_without_fee:agora).
const EVENT = statutoryEvent({ url: 'agora-spring', permissions: statutoryEventPermissions({ see_memberslist_without_fee: { global: true } }) });

const UTRECHT = membersListBody({ id: 3, name: 'AEGEE-Utrecht', type: 'antenna' });
const ZAGREB = membersListBody({ id: 5, name: 'AEGEE-Zagreb', type: 'contact antenna' });
const LVIV = membersListBody({ id: 6, name: 'AEGEE-Lviv', type: 'contact' });

const mockPage = (api: ApiMock, bodies: MembersListBody[] = [UTRECHT, ZAGREB, LVIV]): void => {
    api.json('GET statutory /events/:id', ok(EVENT));
    api.json('GET statutory /events/:id/memberslists/without_fee', ok(bodies));
};

const table = (page: Page) => page.getByRole('region', { name: 'Members lists without fee' }).getByRole('table');
const rowOf = (page: Page, name: string) => tableRows(table(page)).filter({ hasText: name });

test.describe('the locals whose members list has no fee', () => {
    test('lists the locals whose members list has no fee, with their type', async ({ page, api }) => {
        mockPage(api);
        await page.goto('/statutory/agora-spring/memberslist/list/without_fee');

        await expect(page.getByRole('heading', { name: 'List all memberslists without fee for Agora Spring' })).toBeVisible();
        await expect(page).toHaveTitle('MyAEGEE | List members lists without fee');
        await expect(tableRows(table(page))).toHaveCount(3);

        const utrecht = rowOf(page, 'AEGEE-Utrecht');
        await expect(await cellOf(table(page), utrecht, 'Body name')).toHaveText('AEGEE-Utrecht');
        await expect(await cellOf(table(page), utrecht, 'Type')).toHaveText('Antenna');
        await expect(await cellOf(table(page), rowOf(page, 'AEGEE-Zagreb'), 'Type')).toHaveText('Contact antenna');
        await expect(await cellOf(table(page), rowOf(page, 'AEGEE-Lviv'), 'Type')).toHaveText('Contact');
        // statutory names the bodies itself, so the page asks core for nothing.
        expect(api.callsTo('GET statutory /events/:id/memberslists/without_fee').map((call) => call.params)).toEqual([{ id: 'agora-spring' }]);
    });

    test('each body links to its page', async ({ page, api }) => {
        mockPage(api);
        await page.goto('/statutory/agora-spring/memberslist/list/without_fee');

        await expect(rowOf(page, 'AEGEE-Utrecht').getByRole('link', { name: 'AEGEE-Utrecht' })).toHaveAttribute('href', '/bodies/3');
        await expect(rowOf(page, 'AEGEE-Zagreb').getByRole('link', { name: 'AEGEE-Zagreb' })).toHaveAttribute('href', '/bodies/5');
    });

    test('the bodies can be sorted by name and by type', async ({ page, api, layout }) => {
        mockPage(api);
        await page.goto('/statutory/agora-spring/memberslist/list/without_fee');
        await expect(tableRows(table(page))).toHaveCount(3);

        await sortBy(table(page), 'Body name', layout);
        await expect(tableRows(table(page)).nth(0)).toContainText('AEGEE-Lviv');
        await expect(tableRows(table(page)).nth(2)).toContainText('AEGEE-Zagreb');

        await sortBy(table(page), 'Type', layout);
        await expect(tableRows(table(page)).nth(0)).toContainText('AEGEE-Utrecht');
        await expect(tableRows(table(page)).nth(2)).toContainText('AEGEE-Zagreb');
    });

    test('every members list has a fee', async ({ page, api }) => {
        mockPage(api, []);
        await page.goto('/statutory/agora-spring/memberslist/list/without_fee');

        await expect.poll(() => api.callsTo('GET statutory /events/:id/memberslists/without_fee').length).toBe(1);
        await expectEmptyTable(table(page));
    });

    test('the table says it is loading while the bodies come', async ({ page, api }) => {
        api.json('GET statutory /events/:id', ok(EVENT));
        api.on('GET statutory /events/:id/memberslists/without_fee', { json: ok([UTRECHT]), delayMs: 1000 });
        await page.goto('/statutory/agora-spring/memberslist/list/without_fee');

        await expect(page.getByRole('region', { name: 'Members lists without fee' })).toHaveAttribute('aria-busy', 'true');
        await expect(page.getByRole('region', { name: 'Members lists without fee' })).toHaveAttribute('aria-busy', 'false');
        await expect(tableRows(table(page))).toHaveCount(1);
    });

    test('someone who may not see them is told so', async ({ page, api }) => {
        api.json('GET statutory /events/:id', ok(statutoryEvent({ url: 'agora-spring' })));
        api.on('GET statutory /events/:id/memberslists/without_fee', { status: 403, json: forbidden('You are not allowed to see memberslists without fee.') });
        await page.goto('/statutory/agora-spring/memberslist/list/without_fee');

        await expect(toast(page, 'Could not fetch members lists: You are not allowed to see memberslists without fee.')).toBeVisible();
        await expectEmptyTable(table(page));
    });

    test('an event that is no Agora has no members lists', async ({ page, api }) => {
        api.json('GET statutory /events/:id', ok(statutoryEvent({ type: 'epm', url: 'epm-spring' })));
        api.on('GET statutory /events/:id/memberslists/without_fee', { status: 400, json: badRequest('You can only access memberslist for Agora.') });
        await page.goto('/statutory/epm-spring/memberslist/list/without_fee');

        await expect(toast(page, 'Could not fetch members lists: You can only access memberslist for Agora.')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'List all memberslists without fee for EPM Spring' })).toBeVisible();
    });

    test('an unknown event is said so', async ({ page, api }) => {
        api.on('GET statutory /events/:id', { status: 404, json: notFound('Event with such url or ID is not found.') });
        await page.goto('/statutory/nope/memberslist/list/without_fee');

        await expect(toast(page, 'Could not fetch members lists: Event with such url or ID is not found.')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'List all memberslists without fee for event that is still loading...' })).toBeVisible();
    });

    test('a list that can\'t be loaded is said so', async ({ page, api }) => {
        api.json('GET statutory /events/:id', ok(EVENT));
        api.on('GET statutory /events/:id/memberslists/without_fee', { status: 500, json: { success: false, message: 'Database is down' } });
        await page.goto('/statutory/agora-spring/memberslist/list/without_fee');

        await expect(toast(page, 'Could not fetch members lists: Database is down')).toBeVisible();
    });
});
