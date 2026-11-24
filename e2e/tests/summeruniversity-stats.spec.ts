// The statistics of a season, against the real services: SUCT (allowed to see them through the
// approve and manage permissions core gives SUCT) opens the Statistics page for a season with one
// application, sees the applicant under their antenna, and exports the applicants by body as an
// xlsx with the antenna's row.
// The season, the SU and the application are made through the API; the details of the page are
// covered by the mocked-API suite in ui/summeruniversity/stats.spec.ts. The season stays inactive,
// as the active one is what every other test's SU list shows.
import { readFile } from 'node:fs/promises';

import type { Page } from '@playwright/test';
import { parse } from 'node-xlsx';

import { test, expect, loginInBrowser } from '../support/api.ts';
import { applyToSu, createSeason, createSuEvent, openSuEvent } from '../support/summeruniversity-data.ts';

// The rows of a section of the page (not its header), as "<name> <value>".
const rowsOf = async (page: Page, name: string): Promise<string[]> => (await page.getByRole('table', { name }).getByRole('row').filter({ has: page.getByRole('cell') }).allInnerTexts())
    .map((text) => text.trim().replace(/\s+/g, ' '));

const total = (page: Page, label: string) => page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: label }) }).getByRole('cell');

test.describe('the statistics of a Summer University season', () => {
    test('SUCT sees the applicant under their antenna and exports the applicants by body', async ({ api, page }) => {
        const season = await createSeason(api);
        const event = await createSuEvent(api, { season: season.year });
        await openSuEvent(api, event.id);
        await applyToSu(api, 'member', event);
        const antenna = (await api.me('member')).bodies[0].name;

        await loginInBrowser(page, api, 'suct');
        await page.goto('/summeruniversity/stats');
        await expect(page.getByRole('heading', { name: 'Summer University statistics', level: 1 })).toBeVisible();
        await page.getByRole('combobox', { name: 'Season' }).selectOption(String(season.year));

        await expect.poll(() => rowsOf(page, 'Applicants by body')).toEqual([`${antenna} 1`]);
        expect(await rowsOf(page, 'Applications by event')).toEqual([`${event.name} 1`]);
        expect(await rowsOf(page, 'Applicants by nationality')).toEqual(['Belgium 1']);
        await expect(total(page, 'Total applications:')).toHaveText('1');
        await expect(total(page, 'Unique applicants:')).toHaveText('1');
        await expect(total(page, 'Confirmed applications:')).toHaveText('0');

        const downloading = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Export applicants by body' }).click();
        const download = await downloading;
        expect(download.suggestedFilename()).toBe(`su_stats_by_body_${season.year}.xlsx`);

        const sheets = parse(await readFile(await download.path()));
        expect(sheets.map((sheet) => ({ name: sheet.name, data: sheet.data }))).toEqual([{
            name: 'By body',
            data: [['Body', 'Applicants'], [antenna, 1]]
        }]);
    });
});
