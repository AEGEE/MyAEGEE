// Statistics (/summeruniversity/stats): the applications of a season, per Summer University,
// body and nationality, and the export of the applicants per body.
import type { Page } from '@playwright/test';

import { forbidden, ok } from '../support/factories/base.ts';
import { suSeason, suStats, type SuStats } from '../support/factories/summeruniversity.ts';
import { tableRows, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const SEASONS = [suSeason({ year: 2027, active: true }), suSeason({ year: 2026, active: false })];

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// The value next to a total.
const total = (page: Page, label: string) => page.getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: label }) })
    .getByRole('cell');

const section = (page: Page, name: string) => page.getByRole('table', { name });

// The rows of a section, as "<name> <value>".
const rowsOf = async (page: Page, name: string): Promise<string[]> => (await tableRows(section(page, name)).allInnerTexts())
    .map((text) => text.trim().replace(/\s+/g, ' '));

const EMPTY: SuStats = {
    by_event: [],
    by_body: [],
    by_nationality: [],
    by_status: [{ type: 'total_applications', value: 0 }, { type: 'total_members', value: 0 }, { type: 'confirmed', value: 0 }]
};

test.describe('Summer University statistics', () => {
    test('shows the active season\'s statistics, most applications first', async ({ page, api }) => {
        api.json('GET summeruniversity /seasons', ok(SEASONS));
        api.json('GET summeruniversity /applications', ok(suStats({
            by_event: [{ type: 'Summer University Beta', value: 2 }, { type: 'Summer University Alpha', value: 2 }, { type: 'Summer University Gamma', value: 5 }],
            by_body: [{ type: 'AEGEE-Antenna', value: 3 }, { type: 'AEGEE-Other', value: 4 }],
            by_nationality: [{ type: 'Belgium', value: 6 }, { type: 'Spain', value: 1 }],
            by_status: [{ type: 'total_applications', value: 9 }, { type: 'total_members', value: 7 }, { type: 'confirmed', value: 3 }]
        })));
        await page.goto('/summeruniversity/stats');

        await expect(page.getByRole('heading', { name: 'Summer University statistics', level: 1 })).toBeVisible();
        await expect(page.getByLabel('Season')).toHaveValue('2027');
        await expect(total(page, 'Total applications:')).toHaveText('9');
        await expect(total(page, 'Unique applicants:')).toHaveText('7');
        await expect(total(page, 'Confirmed applications:')).toHaveText('3');

        // By value, the higher first; equal values by name.
        await expect(tableRows(section(page, 'Applications by event'))).toHaveCount(3);
        expect(await rowsOf(page, 'Applications by event')).toEqual(['Summer University Gamma 5', 'Summer University Alpha 2', 'Summer University Beta 2']);
        expect(await rowsOf(page, 'Applicants by body')).toEqual(['AEGEE-Other 4', 'AEGEE-Antenna 3']);
        expect(await rowsOf(page, 'Applicants by nationality')).toEqual(['Belgium 6', 'Spain 1']);

        expect(api.callsTo('GET summeruniversity /applications').map((call) => call.query.toString())).toEqual(['season=2027']);
        await expect(page.getByRole('button', { name: 'Export applicants by body' })).toBeEnabled();
    });

    test('without an active season all seasons are shown and the export is off', async ({ page, api }) => {
        api.json('GET summeruniversity /seasons', ok([suSeason({ year: 2026, active: false })]));
        api.json('GET summeruniversity /applications', ok(suStats()));
        await page.goto('/summeruniversity/stats');

        await expect(total(page, 'Total applications:')).toHaveText('3');
        await expect(page.getByLabel('Season').getByRole('option', { selected: true })).toHaveText('All seasons');
        await expect(page.getByRole('button', { name: 'Export applicants by body' })).toBeDisabled();
        await expect(page.getByText('Select a season to export the applicants by body.')).toBeVisible();
        expect(api.callsTo('GET summeruniversity /applications').map((call) => call.query.toString())).toEqual(['']);
    });

    test('choosing another season loads it, and "All seasons" leaves the season out', async ({ page, api }) => {
        api.json('GET summeruniversity /seasons', ok(SEASONS));
        api.on('GET summeruniversity /applications', ({ query }) => ({
            json: ok(suStats({ by_status: [{ type: 'total_applications', value: Number(query.get('season') ?? 1) }, { type: 'total_members', value: 1 }, { type: 'confirmed', value: 0 }] }))
        }));
        await page.goto('/summeruniversity/stats');
        await expect(total(page, 'Total applications:')).toHaveText('2027');

        await page.getByLabel('Season').selectOption('2026');
        await expect(total(page, 'Total applications:')).toHaveText('2026');
        await expect(page.getByRole('button', { name: 'Export applicants by body' })).toBeEnabled();

        await page.getByLabel('Season').selectOption({ label: 'All seasons' });
        await expect(total(page, 'Total applications:')).toHaveText('1');
        await expect(page.getByRole('button', { name: 'Export applicants by body' })).toBeDisabled();

        expect(api.callsTo('GET summeruniversity /applications').map((call) => call.query.toString())).toEqual(['season=2027', 'season=2026', '']);
    });

    test('a late answer for the season chosen before doesn\'t replace the current one', async ({ page, api }) => {
        let release!: () => void;
        const released = new Promise<void>((resolve) => { release = resolve; });
        api.json('GET summeruniversity /seasons', ok(SEASONS));
        api.on('GET summeruniversity /applications', async ({ query }) => {
            if (query.get('season') === '2027') {
                await released;
                return { json: ok(suStats({ by_body: [{ type: 'AEGEE-Late', value: 1 }] })) };
            }
            return { json: ok(suStats({ by_body: [{ type: 'AEGEE-Current', value: 2 }] })) };
        });
        // The mock records a call once it has answered it, so wait for the request itself.
        const first = page.waitForRequest((request) => request.url().includes('season=2027'));
        await page.goto('/summeruniversity/stats');
        await first;

        await page.getByLabel('Season').selectOption('2026');
        await expect(section(page, 'Applicants by body')).toContainText('AEGEE-Current');

        const late = page.waitForResponse((response) => response.url().includes('season=2027'));
        release();
        await late;
        // Two frames: the page has handled the answer by then.
        await page.evaluate(() => new Promise((resolve) => { requestAnimationFrame(() => requestAnimationFrame(resolve)); }));
        await expect(section(page, 'Applicants by body')).toContainText('AEGEE-Current');
        await expect(section(page, 'Applicants by body')).not.toContainText('AEGEE-Late');
    });

    test('a late error for the season chosen before is not shown', async ({ page, api }) => {
        let release!: () => void;
        const released = new Promise<void>((resolve) => { release = resolve; });
        api.json('GET summeruniversity /seasons', ok(SEASONS));
        api.on('GET summeruniversity /applications', async ({ query }) => {
            if (query.get('season') === '2027') {
                await released;
                return { status: 403, json: forbidden('You are not allowed to see the application statistics.') };
            }
            return { json: ok(suStats({ by_body: [{ type: 'AEGEE-Current', value: 2 }] })) };
        });
        // The mock records a call once it has answered it, so wait for the request itself.
        const first = page.waitForRequest((request) => request.url().includes('season=2027'));
        await page.goto('/summeruniversity/stats');
        await first;

        await page.getByLabel('Season').selectOption('2026');
        await expect(section(page, 'Applicants by body')).toContainText('AEGEE-Current');

        const late = page.waitForResponse((response) => response.url().includes('season=2027'));
        release();
        await late;
        await page.evaluate(() => new Promise((resolve) => { requestAnimationFrame(() => requestAnimationFrame(resolve)); }));
        await expect(toast(page, 'Could not fetch statistics')).toHaveCount(0);
        await expect(section(page, 'Applicants by body')).toContainText('AEGEE-Current');
    });

    test('a failed request empties the tables and shows the error', async ({ page, api }) => {
        api.json('GET summeruniversity /seasons', ok(SEASONS));
        api.on('GET summeruniversity /applications', ({ query }) => (query.get('season') === '2027' ? { json: ok(suStats()) } : { abort: 'failed' }));
        await page.goto('/summeruniversity/stats');
        await expect(total(page, 'Total applications:')).toHaveText('3');

        await page.getByLabel('Season').selectOption('2026');

        await expect(toast(page, 'Could not fetch statistics: Network Error')).toBeVisible();
        await expect(total(page, 'Total applications:')).toHaveText('0');
        await expect(total(page, 'Unique applicants:')).toHaveText('0');
        await expect(total(page, 'Confirmed applications:')).toHaveText('0');
        await expect(section(page, 'Applicants by body')).toContainText('No data.');
        await expect(tableRows(section(page, 'Applicants by body'))).toHaveText(['No data.']);
    });

    test('a season without applications says so in every section', async ({ page, api }) => {
        api.json('GET summeruniversity /seasons', ok(SEASONS));
        api.json('GET summeruniversity /applications', ok(EMPTY));
        await page.goto('/summeruniversity/stats');

        for (const name of ['Applications by event', 'Applicants by body', 'Applicants by nationality']) {
            await expect(tableRows(section(page, name))).toHaveText(['No data.']);
        }
        await expect(total(page, 'Total applications:')).toHaveText('0');
    });

    test('a failed seasons request still shows the statistics of all seasons', async ({ page, api }) => {
        api.on('GET summeruniversity /seasons', { abort: 'failed' });
        api.json('GET summeruniversity /applications', ok(suStats()));
        await page.goto('/summeruniversity/stats');

        await expect(toast(page, 'Could not fetch seasons: Network Error')).toBeVisible();
        await expect(total(page, 'Total applications:')).toHaveText('3');
        await expect(page.getByLabel('Season').getByRole('option')).toHaveText(['All seasons']);
        expect(api.callsTo('GET summeruniversity /applications').map((call) => call.query.toString())).toEqual(['']);
    });

    test('exporting downloads the applicants by body of the season', async ({ page, api }) => {
        api.json('GET summeruniversity /seasons', ok(SEASONS));
        api.json('GET summeruniversity /applications', ok(suStats()));
        api.on('GET summeruniversity /applications/export', {
            body: Buffer.from('PK\u0003\u0004 not really a spreadsheet'),
            contentType: XLSX,
            headers: { 'content-disposition': 'attachment; filename=su_stats_by_body_2026.xlsx' }
        });
        await page.goto('/summeruniversity/stats');
        await page.getByLabel('Season').selectOption('2026');

        const download = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Export applicants by body' }).click();

        expect((await download).suggestedFilename()).toBe('su_stats_by_body_2026.xlsx');
        await expect(page.getByRole('button', { name: 'Export applicants by body' })).toBeEnabled();
        expect(api.callsTo('GET summeruniversity /applications/export').map((call) => call.query.toString())).toEqual(['season=2026']);
    });

    test('a refused export shows the service\'s message', async ({ page, api }) => {
        api.json('GET summeruniversity /seasons', ok(SEASONS));
        api.json('GET summeruniversity /applications', ok(suStats()));
        api.on('GET summeruniversity /applications/export', { status: 403, json: forbidden('You are not allowed to export the application statistics.') });
        await page.goto('/summeruniversity/stats');

        await page.getByRole('button', { name: 'Export applicants by body' }).click();

        await expect(toast(page, 'Could not export statistics: You are not allowed to export the application statistics.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Export applicants by body' })).toBeEnabled();
    });

    test('a failed export without a message shows the HTTP error', async ({ page, api }) => {
        api.json('GET summeruniversity /seasons', ok(SEASONS));
        api.json('GET summeruniversity /applications', ok(suStats()));
        // A gateway's own error page, not an answer of the service.
        api.on('GET summeruniversity /applications/export', { status: 502, body: '<html><body>Bad Gateway</body></html>', contentType: 'text/html' });
        await page.goto('/summeruniversity/stats');

        await page.getByRole('button', { name: 'Export applicants by body' }).click();

        await expect(toast(page, 'Could not export statistics: Request failed with status code 502')).toBeVisible();
    });

    test('a member without the permission sees the service\'s message', async ({ page, api }) => {
        api.json('GET summeruniversity /seasons', ok(SEASONS));
        api.on('GET summeruniversity /applications', { status: 403, json: forbidden('You are not allowed to see the application statistics.') });
        await page.goto('/summeruniversity/stats');

        await expect(toast(page, 'Could not fetch statistics: You are not allowed to see the application statistics.')).toBeVisible();
        await expect(total(page, 'Total applications:')).toHaveText('0');
    });
});
