// The boards listing (/network/boards): every antenna, contact antenna and contact with the
// dates of its latest board, for the Network Commission to see whose board is out of date.
// The page reads the bodies from core and the boards from network; the menu entry is for
// holders of global:manage_network:boards, while network lets every holder of
// global:view:board read the boards.
import type { Page } from '@playwright/test';

import { ok } from '../support/factories/base.ts';
import { body, permission, seedPermissions } from '../support/factories/core.ts';
import { board } from '../support/factories/network.ts';
import { cellOf, expectEmptyTable, freezeTime, openMenu, tableRows, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const ALPHA = body({ id: 11, name: 'AEGEE-Alpha', code: 'ALP', type: 'antenna' });
const BETA = body({ id: 12, name: 'AEGEE-Beta', code: 'BET', type: 'contact antenna' });
const GAMMA = body({ id: 13, name: 'AEGEE-Gamma', code: 'GAM', type: 'contact' });
const WORKING_GROUP = body({ id: 14, name: 'IT Working Group', code: 'ITW', type: 'working group' });

// What network answers, newest term first (the page asks for `sort=start_date&direction=desc`):
// Alpha's current board and its previous one, and nothing for the others.
const ALPHA_BOARD = board({ body_id: ALPHA.id, elected_date: '2026-11-20', start_date: '2027-01-01', end_date: '2027-12-31' });
const ALPHA_OLD_BOARD = board({ body_id: ALPHA.id, elected_date: '2025-11-20', start_date: '2026-01-01', end_date: '2026-12-31' });

const page_ = (page: Page) => page.getByRole('article', { name: 'View current boards and election dates' });
const table = (page: Page) => page_(page).getByRole('table');
const types = (page: Page) => page.getByRole('combobox', { name: 'Filter on body type' });

test.describe('boards listing', () => {
    test.beforeEach(({ myPermissions }) => {
        // A Network Commissioner: global:manage_network:boards and global:view:board.
        myPermissions.splice(0, myPermissions.length, ...seedPermissions('membersCircle', 'netcomCircle'));
    });

    test('lists antennae, contact antennae and contacts with the dates of their latest board', async ({ page, api }) => {
        api.json('GET core /bodies', ok([ALPHA, BETA, GAMMA, WORKING_GROUP]));
        api.json('GET network /boards', ok([ALPHA_BOARD, ALPHA_OLD_BOARD]));

        await page.goto('/network/boards');

        const rows = tableRows(table(page));
        await expect(rows).toHaveCount(3);
        const alpha = rows.filter({ hasText: 'AEGEE-Alpha' });
        await expect(await cellOf(table(page), alpha, 'Body code')).toHaveText('ALP');
        await expect((await cellOf(table(page), alpha, 'Body name')).getByRole('link', { name: 'AEGEE-Alpha' })).toHaveAttribute('href', '/bodies/11');
        await expect(await cellOf(table(page), alpha, 'Type')).toHaveText('Antenna');
        await expect(await cellOf(table(page), alpha, 'Election')).toHaveText('2026-11-20');
        await expect(await cellOf(table(page), alpha, 'Term start')).toHaveText('2027-01-01');
        await expect(await cellOf(table(page), alpha, 'Term end')).toHaveText('2027-12-31');

        const beta = rows.filter({ hasText: 'AEGEE-Beta' });
        await expect(await cellOf(table(page), beta, 'Type')).toHaveText('Contact antenna');
        await expect(await cellOf(table(page), beta, 'Election')).toHaveText('-');
        await expect(await cellOf(table(page), beta, 'Term start')).toHaveText('-');
        await expect(await cellOf(table(page), beta, 'Term end')).toHaveText('-');
        await expect(await cellOf(table(page), rows.filter({ hasText: 'AEGEE-Gamma' }), 'Type')).toHaveText('Contact');
        await expect(rows.filter({ hasText: 'IT Working Group' })).toHaveCount(0);

        // Without a search, and without deleted bodies.
        expect(api.callsTo('GET core /bodies').map((call) => Object.fromEntries(call.query))).toEqual([{}]);
        expect(api.callsTo('GET network /boards').map((call) => Object.fromEntries(call.query))).toEqual([{ sort: 'start_date', direction: 'desc' }]);
        await expect(types(page)).toContainText('Antenna');
        await expect(page_(page).getByRole('button', { name: 'Also show deleted bodies' })).toHaveCount(0);
    });

    test('shows every type of body once the type filters are removed', async ({ page, api }) => {
        api.json('GET core /bodies', ok([ALPHA, BETA, GAMMA, WORKING_GROUP]));
        api.json('GET network /boards', ok([ALPHA_BOARD]));

        await page.goto('/network/boards');
        await expect(tableRows(table(page))).toHaveCount(3);

        await types(page).getByRole('button', { name: 'Remove Contact antenna' }).click();
        await expect(tableRows(table(page))).toHaveCount(2);
        await expect(tableRows(table(page)).filter({ hasText: 'AEGEE-Beta' })).toHaveCount(0);

        await types(page).getByRole('button', { name: 'Remove Antenna' }).click();
        await types(page).getByRole('button', { name: 'Remove Contact' }).click();
        await expect(tableRows(table(page))).toHaveCount(4);
        await expect(await cellOf(table(page), tableRows(table(page)).filter({ hasText: 'IT Working Group' }), 'Type')).toHaveText('Working group');
        // Every change of the filter asks again.
        expect(api.callsTo('GET core /bodies')).toHaveLength(4);
    });

    test('chooses body types in the list of types', async ({ page, api }) => {
        api.json('GET core /bodies', ok([ALPHA, BETA, GAMMA, WORKING_GROUP]));
        api.json('GET network /boards', ok([]));

        await page.goto('/network/boards');
        await expect(tableRows(table(page))).toHaveCount(3);

        await types(page).click();
        await expect(types(page)).toHaveAttribute('aria-expanded', 'true');
        // Choosing a selected type again takes it out.
        await page.getByRole('option', { name: /^Contact antenna/ }).click();
        await page.getByRole('option', { name: /^Antenna/ }).click();
        await expect(tableRows(table(page))).toHaveCount(1);
        await expect(tableRows(table(page)).filter({ hasText: 'AEGEE-Gamma' })).toHaveCount(1);

        await page.getByRole('option', { name: /^Antenna/ }).click();
        await expect(tableRows(table(page))).toHaveCount(2);
        await page.keyboard.press('Escape');
        await expect(types(page)).toHaveAttribute('aria-expanded', 'false');
    });

    test('only bodies without a current board are left with that filter', async ({ page, api }) => {
        await freezeTime(page, '2027-03-01T10:00:00+01:00');
        const ended = body({ id: 21, name: 'AEGEE-Ended', type: 'antenna' });
        const endsToday = body({ id: 22, name: 'AEGEE-Today', type: 'antenna' });
        api.json('GET core /bodies', ok([ALPHA, BETA, ended, endsToday]));
        api.json('GET network /boards', ok([
            ALPHA_BOARD,
            board({ body_id: ended.id, elected_date: '2025-11-01', start_date: '2026-01-01', end_date: '2027-02-28' }),
            board({ body_id: endsToday.id, elected_date: '2025-11-01', start_date: '2026-03-01', end_date: '2027-03-01' })
        ]));

        await page.goto('/network/boards');
        await expect(tableRows(table(page))).toHaveCount(4);

        await page_(page).getByRole('checkbox', { name: 'Only display bodies without a current board' }).check();

        const rows = tableRows(table(page));
        await expect(rows).toHaveCount(2);
        await expect(rows.filter({ hasText: 'AEGEE-Beta' })).toHaveCount(1);
        await expect(rows.filter({ hasText: 'AEGEE-Ended' })).toHaveCount(1);
        // Filtered in the page: nothing was asked again.
        expect(api.callsTo('GET core /bodies')).toHaveLength(1);

        await page_(page).getByRole('checkbox', { name: 'Only display bodies without a current board' }).uncheck();
        await expect(rows).toHaveCount(4);
    });

    test('a search asks core for the bodies that match and replaces the rows', async ({ page, api }) => {
        api.on('GET core /bodies', ({ query }) => ({ json: ok(query.get('query') === 'Gam' ? [GAMMA] : [ALPHA, BETA, GAMMA]) }));
        api.json('GET network /boards', ok([ALPHA_BOARD]));

        await page.goto('/network/boards');
        await expect(tableRows(table(page))).toHaveCount(3);

        await page_(page).getByRole('textbox', { name: 'Search by name, body code or abbreviation' }).fill('Gam');

        await expect(tableRows(table(page))).toHaveCount(1);
        await expect(tableRows(table(page)).filter({ hasText: 'AEGEE-Gamma' })).toHaveCount(1);
        expect(api.callsTo('GET core /bodies').map((call) => Object.fromEntries(call.query))).toEqual([{}, { query: 'Gam' }]);
        await expect(page_(page)).not.toHaveAttribute('aria-busy');
    });

    test('a search that is overtaken by the next one is dropped without an error', async ({ page, api }) => {
        let release = (): void => {};
        const held = new Promise<void>((resolve) => { release = resolve; });
        let asked = (): void => {};
        const askedForA = new Promise<void>((resolve) => { asked = resolve; });
        api.on('GET core /bodies', async ({ query }) => {
            if (query.get('query') === 'A') {
                asked();
                await held;
                return { json: ok([ALPHA, BETA]) };
            }
            return { json: ok([BETA]) };
        });
        api.json('GET network /boards', ok([]));

        await page.goto('/network/boards');
        await expect(tableRows(table(page))).toHaveCount(1);

        const search = page_(page).getByRole('textbox', { name: 'Search by name, body code or abbreviation' });
        await search.fill('A');
        await askedForA;
        await search.fill('AEGEE-Beta');
        await expect.poll(() => api.callsTo('GET core /bodies').map((call) => call.query.get('query'))).toContain('AEGEE-Beta');
        release();

        await expect(tableRows(table(page))).toHaveCount(1);
        await expect(tableRows(table(page)).filter({ hasText: 'AEGEE-Beta' })).toHaveCount(1);
        await expect(toast(page, /Could not fetch/)).toHaveCount(0);
        await expect(page_(page)).not.toHaveAttribute('aria-busy');
    });

    test('with view_deleted:body a toggle includes deleted bodies and shows their status', async ({ page, api, myPermissions }) => {
        myPermissions.push(permission('global:view_deleted:body'));
        const deleted = body({ id: 31, name: 'AEGEE-Closed', type: 'antenna', status: 'deleted' });
        api.on('GET core /bodies', ({ query }) => ({ json: ok(query.get('all') === 'true' ? [ALPHA, deleted] : [ALPHA]) }));
        api.json('GET network /boards', ok([ALPHA_BOARD]));

        await page.goto('/network/boards');
        await expect(tableRows(table(page))).toHaveCount(1);

        await page_(page).getByRole('button', { name: 'Also show deleted bodies' }).click();

        const rows = tableRows(table(page));
        await expect(rows).toHaveCount(2);
        await expect(await cellOf(table(page), rows.filter({ hasText: 'AEGEE-Closed' }), 'Status')).toHaveText('Deleted');
        await expect(await cellOf(table(page), rows.filter({ hasText: 'AEGEE-Alpha' }), 'Status')).toHaveText('Active');
        expect(api.callsTo('GET core /bodies').map((call) => Object.fromEntries(call.query))).toEqual([{}, { all: 'true' }]);

        await page_(page).getByRole('button', { name: 'Only show active bodies' }).click();
        await expect(rows).toHaveCount(1);
        await expect(page_(page).getByRole('button', { name: 'Also show deleted bodies' })).toBeVisible();
        expect(api.callsTo('GET core /bodies').map((call) => Object.fromEntries(call.query))).toEqual([{}, { all: 'true' }, {}]);
    });

    test('says so when there are no bodies', async ({ page, api }) => {
        api.json('GET core /bodies', ok([]));
        api.json('GET network /boards', ok([]));

        await page.goto('/network/boards');

        await expect(page_(page)).not.toHaveAttribute('aria-busy');
        await expectEmptyTable(table(page));
    });

    test('says so when the boards cannot be loaded, and stops loading', async ({ page, api }) => {
        api.json('GET core /bodies', ok([ALPHA]));
        api.on('GET network /boards', { status: 500, json: { success: false, message: 'Database is down' } });

        await page.goto('/network/boards');

        await expect(toast(page, 'Could not fetch boards list: Database is down')).toBeVisible();
        await expect(page_(page)).not.toHaveAttribute('aria-busy');
    });

    test('says so when the bodies cannot be loaded, and stops loading', async ({ page, api }) => {
        api.on('GET core /bodies', { status: 500, json: { success: false, message: 'Core is down' } });

        await page.goto('/network/boards');

        await expect(toast(page, 'Could not fetch bodies list: Core is down')).toBeVisible();
        await expect(page_(page)).not.toHaveAttribute('aria-busy');
        await expectEmptyTable(table(page));
    });

    test('takes the permissions from the session instead of asking for them on every search', async ({ page, api }) => {
        api.json('GET core /bodies', ok([ALPHA]));
        api.json('GET network /boards', ok([ALPHA_BOARD]));

        await page.goto('/network/boards');
        await expect(tableRows(table(page))).toHaveCount(1);
        await page_(page).getByRole('textbox', { name: 'Search by name, body code or abbreviation' }).fill('Alpha');
        await expect.poll(() => api.callsTo('GET network /boards')).toHaveLength(2);
        await expect(page_(page)).not.toHaveAttribute('aria-busy');

        // The app asked once, when it started.
        expect(api.callsTo('GET core /my_permissions')).toHaveLength(1);
    });

    test('the menu leads holders of manage_network:boards to the page', async ({ page, api, layout }) => {
        api.json('GET core /bodies', ok([ALPHA]));
        api.json('GET network /boards', ok([ALPHA_BOARD]));

        await page.goto('/network/boards');
        await expect(tableRows(table(page))).toHaveCount(1);

        const menu = await openMenu(page, layout);
        await expect(menu.getByRole('list', { name: 'Network', exact: true }).getByRole('link', { name: 'Boards listing' })).toHaveAttribute('href', '/network/boards');
    });
});

test.describe('boards listing for a member', () => {
    test('a member who opens the page sees the list, but the menu has no entry for it', async ({ page, api, layout, myPermissions }) => {
        // Members read boards through global:view:board (given to the members circle by network's
        // board rules); the menu entry stays for holders of global:manage_network:boards.
        myPermissions.push(permission('global:view:board'));
        api.json('GET core /bodies', ok([ALPHA, BETA]));
        api.json('GET network /boards', ok([ALPHA_BOARD]));

        await page.goto('/network/boards');

        await expect(tableRows(table(page))).toHaveCount(2);
        const menu = await openMenu(page, layout);
        await expect(menu.getByRole('link', { name: 'Boards listing' })).toHaveCount(0);
    });
});
