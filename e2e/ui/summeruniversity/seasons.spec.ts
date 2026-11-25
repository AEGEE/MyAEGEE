// Seasons (/summeruniversity/seasons): the seasons of the Summer Universities and which one is
// active.
import { forbidden, ok } from '../support/factories/base.ts';
import { suSeason } from '../support/factories/summeruniversity.ts';
import { cellOf, dialog, expectEmptyTable, openMenu, tableRows, toast } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { test, expect } from '../support/test.ts';

const ACTIVE = suSeason({
    year: 2027,
    name: 'Summer University 2027',
    active: true,
    // 09:00 UTC is 10:00 in Brussels in winter, 08:00 UTC is 10:00 in summer.
    event_submission_deadline: '2027-01-15T09:00:00.000Z',
    application_period_starts: '2027-03-01T09:00:00.000Z',
    application_period_ends: '2027-04-30T08:00:00.000Z'
});
const PREVIOUS = suSeason({
    year: 2026,
    name: 'Summer University 2026',
    active: false,
    event_submission_deadline: null,
    application_period_starts: null,
    application_period_ends: null
});

// What a service answers when its database can't be reached.
const DATABASE_DOWN = 'connect ECONNREFUSED 127.0.0.1:5432';

test.describe('Summer University seasons', () => {
    test('lists the seasons with their dates and the active one', async ({ page, api }) => {
        api.json('GET summeruniversity /seasons', ok([ACTIVE, PREVIOUS]));
        await page.goto('/summeruniversity/seasons');

        const table = page.getByRole('table');
        const current = tableRows(table).filter({ hasText: 'Summer University 2027' });
        const previous = tableRows(table).filter({ hasText: 'Summer University 2026' });
        await expect(current).toBeVisible();
        await expect(tableRows(table)).toHaveCount(2);

        await expect(await cellOf(table, current, 'Year')).toHaveText('2027');
        await expect(await cellOf(table, current, 'Event submission deadline')).toHaveText('2027-01-15 10:00');
        await expect(await cellOf(table, current, 'Application period')).toHaveText(/^2027-03-01 10:00\s+to\s+2027-04-30 10:00$/);
        await expect(await cellOf(table, current, 'Active')).toHaveText('Active');
        await expect(current.getByRole('button', { name: 'Set active' })).toHaveCount(0);

        // Dates that aren't set yet are a dash.
        await expect(await cellOf(table, previous, 'Event submission deadline')).toHaveText('-');
        await expect(await cellOf(table, previous, 'Application period')).toHaveText(/^-\s+to\s+-$/);
        await expect(previous.getByRole('button', { name: 'Set active' })).toBeVisible();

        await expect(page.getByRole('link', { name: 'Create season' })).toHaveAttribute('href', '/summeruniversity/seasons/new');
        await expect(current.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/summeruniversity/seasons/2027/edit');
        await expect(previous.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/summeruniversity/seasons/2026/edit');
    });

    test('making another season active asks first and moves the tag', async ({ page, api }) => {
        api.json('GET summeruniversity /seasons', ok([ACTIVE, PREVIOUS]));
        api.json('PUT summeruniversity /seasons/:year/active', { success: true, message: 'Season successfully set as active.', data: { ...PREVIOUS, active: true } });
        await page.goto('/summeruniversity/seasons');

        const table = page.getByRole('table');
        const current = tableRows(table).filter({ hasText: 'Summer University 2027' });
        const previous = tableRows(table).filter({ hasText: 'Summer University 2026' });

        // Cancelling changes nothing.
        await previous.getByRole('button', { name: 'Set active' }).click();
        const confirm = dialog(page, 'Set the active season');
        await expect(confirm).toContainText('Are you sure you want to make this season the active one? New events will be created in this season.');
        await confirm.getByRole('button', { name: 'Cancel' }).click();
        await expect(confirm).toBeHidden();
        expect(api.callsTo('PUT summeruniversity /seasons/:year/active')).toHaveLength(0);

        await previous.getByRole('button', { name: 'Set active' }).click();
        await dialog(page, 'Set the active season').getByRole('button', { name: 'Set active' }).click();

        await expect(toast(page, 'The active season is changed.')).toBeVisible();
        await expect(await cellOf(table, previous, 'Active')).toHaveText('Active');
        await expect(current.getByRole('button', { name: 'Set active' })).toBeVisible();
        expect(api.callsTo('PUT summeruniversity /seasons/:year/active').map((call) => call.params.year)).toEqual(['2026']);
    });

    test('a failed activation shows the error and keeps the active season', async ({ page, api }) => {
        api.json('GET summeruniversity /seasons', ok([ACTIVE, PREVIOUS]));
        api.on('PUT summeruniversity /seasons/:year/active', { status: 403, json: forbidden('You are not allowed to manage seasons.') });
        await page.goto('/summeruniversity/seasons');

        const table = page.getByRole('table');
        const current = tableRows(table).filter({ hasText: 'Summer University 2027' });
        const previous = tableRows(table).filter({ hasText: 'Summer University 2026' });
        await previous.getByRole('button', { name: 'Set active' }).click();
        await dialog(page, 'Set the active season').getByRole('button', { name: 'Set active' }).click();

        await expect(toast(page, 'Could not set the active season: You are not allowed to manage seasons.')).toBeVisible();
        await expect(await cellOf(table, current, 'Active')).toHaveText('Active');
        await expect(previous.getByRole('button', { name: 'Set active' })).toBeVisible();
    });

    test('without seasons the table says so', async ({ page, api }) => {
        api.json('GET summeruniversity /seasons', ok([]));
        await page.goto('/summeruniversity/seasons');

        await expect.poll(() => api.callsTo('GET summeruniversity /seasons')).toHaveLength(1);
        await expectEmptyTable(page.getByRole('table'));
        await expect(page.getByRole('link', { name: 'Create season' })).toBeVisible();
    });

    test('a failed request shows the error', async ({ page, api }) => {
        api.on('GET summeruniversity /seasons', { abort: 'failed' });
        await page.goto('/summeruniversity/seasons');

        await expect(toast(page, 'Could not fetch seasons: Network Error')).toBeVisible();
        await expectEmptyTable(page.getByRole('table'));
    });

    test('a member who leaves while the seasons load sees no late error for it', async ({ page, api, layout }) => {
        let release!: () => void;
        const released = new Promise<void>((resolve) => { release = resolve; });
        api.on('GET summeruniversity /seasons', async () => {
            await released;
            return { status: 500, json: { success: false, message: DATABASE_DOWN } };
        });
        // The page the member goes to belongs to another area: any answer will do for it.
        api.fallback(mockEverything);
        // The mock records a call only once it has answered it, so the test waits for the request.
        const isLate = (url: string) => new URL(url).pathname.replace(/\/$/, '') === '/api/summeruniversity/seasons';
        const asked = page.waitForRequest((request) => isLate(request.url()));
        await page.goto('/summeruniversity/seasons');
        await asked;
        await (await openMenu(page, layout)).getByRole('link', { name: 'Dashboard' }).click();
        await expect(page).toHaveURL('/dashboard');

        const late = page.waitForResponse((response) => isLate(response.url()));
        release();
        await late;
        // Two frames: the page has handled the answer by then.
        await page.evaluate(() => new Promise((resolve) => { requestAnimationFrame(() => requestAnimationFrame(resolve)); }));

        // Counted at once: a retrying matcher would only wait until a toast has gone.
        expect(await toast(page, /Could not fetch seasons/).count()).toBe(0);
        await expect(page).toHaveURL('/dashboard');
    });
});
