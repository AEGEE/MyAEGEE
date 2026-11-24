// The statistics and the export of the applications to an Agora against the real services: an
// application manager (admin) reads the statistics, whose bodies come from core, and exports
// the accepted delegates with the filters and fields the page sends. The detailed behaviour of
// each page is covered by the mocked-API suite in ui/statutory/.
import fs from 'node:fs';

import { test, expect, expectStatus, loginInBrowser } from '../support/api.ts';
import { acceptedDelegate } from '../support/statutory-plenaries-data.ts';

test.describe('statistics and export of the applications to an Agora', () => {
    test('the application manager reads the statistics and exports the accepted delegates', async ({ api, page }) => {
        const event = await api.createStatutoryEvent();
        expectStatus(await api.call('admin', 'PUT', `/api/statutory/events/${event.id}/status`, { status: 'published' }), 200);
        await acceptedDelegate(api, event, 'member');
        const body = (await api.me('member')).bodies[0];
        await loginInBrowser(page, api, 'admin');

        await test.step('the statistics count the application and name its body', async () => {
            await page.goto(`/statutory/${event.url}/applications/stats`);

            await expect(page.getByRole('table', { name: 'Numbers of applications' }).getByRole('row', { name: 'Total applications: 1' })).toBeVisible();
            await expect(page.getByRole('table', { name: 'Applications by participant type', exact: true }).getByRole('row', { name: 'delegate (1) 1' })).toHaveCount(1);
            await expect(page.getByRole('table', { name: 'Applications by body', exact: true }).getByRole('row', { name: `${body.name} (1) 1` })).toHaveCount(1);
        });

        await test.step('the accepted delegates are exported with the chosen fields', async () => {
            await page.goto(`/statutory/${event.url}/applications/export`);
            await page.getByLabel('Filter on participant status').selectOption('Accepted participants');
            await page.getByLabel('Filter on cancellation').selectOption('Not cancelled participants');
            await page.getByLabel('Filter on confirmation').selectOption('Not confirmed participants');
            await page.getByLabel('Filter on participant type').selectOption('Delegates');
            await page.getByRole('checkbox', { name: 'Board comment' }).uncheck();

            const download = page.waitForEvent('download');
            await page.getByRole('button', { name: 'Export participants data' }).click();

            const file = await download;
            expect(file.suggestedFilename()).toMatch(/^participants_.*\.xlsx$/);
            // An xlsx file is a zip archive: statutory took the filters and the fields.
            expect(fs.readFileSync(await file.path()).subarray(0, 2).toString()).toBe('PK');
        });
    });
});
