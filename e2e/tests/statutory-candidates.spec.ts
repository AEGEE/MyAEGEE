// The way of a candidature for a position of an Agora against the real services: the Juridical
// Commission opens a position, a member applies for it with a picture, the Commission approves
// the candidature, and exports the candidatures. The detailed behaviour of each page is covered
// by the mocked-API suite in ui/statutory/.
import fs from 'node:fs';
import path from 'node:path';

import type { Page } from '@playwright/test';

import type { Envelope } from '../support/api.ts';
import { test, expect, expectStatus, loginInBrowser } from '../support/api.ts';
import { serviceEnv } from '../support/constants.ts';
import { grantPermission } from '../support/core-data.ts';
import { completeProfile } from '../support/statutory-applications-data.ts';
import { spreadsheetRows } from '../support/statutory-candidates-data.ts';
import { cellOf, tableRows, toast } from '../ui/support/shell.ts';

const PICTURE = fs.readFileSync(path.join(import.meta.dirname, '../ui/fixtures/statutory/agora-logo.png'));

const positionsTable = (page: Page) => page.getByRole('region', { name: 'Positions' }).getByRole('table');

const selectPosition = async (page: Page, name: string): Promise<void> => {
    const table = positionsTable(page);
    await (await cellOf(table, tableRows(table).filter({ hasText: name }), 'Name')).click();
    await expect(page.getByRole('heading', { name: 'Applications for selected position' })).toBeVisible();
};

test.describe('a candidature for a position of an Agora', () => {
    test('a member applies, the Juridical Commission approves and exports the candidature', async ({ api, page, otherAntenna }) => {
        test.slow();
        const { body, member } = otherAntenna;
        const candidateName = `${member.first_name} ${member.last_name}`;
        const positionName = `Network Director ${member.last_name}`;
        await completeProfile(api, member);
        // `board` is in the Juridical Commission for this test.
        const [, leaveCommission] = await grantPermission(api, 'board', 'global:manage_candidates:agora');
        try {
            const event = await api.createStatutoryEvent();
            expectStatus(await api.call('admin', 'PUT', `/api/statutory/events/${event.id}/status`, { status: 'published' }), 200);

            await test.step('the Juridical Commission opens a position', async () => {
                await loginInBrowser(page, api, 'board');
                await page.goto(`/statutory/${event.url}`);
                await page.getByRole('link', { name: 'Manage candidates' }).click();
                await expect(page).toHaveURL(`/statutory/${event.url}/positions/all`);

                await page.getByRole('button', { name: 'Create a position' }).click();
                const modal = page.getByRole('dialog', { name: 'Add position' });
                // The applications open now and close two weeks before the Agora.
                await modal.getByLabel('Name').fill(positionName);
                await modal.getByLabel('Places available').fill('1');
                await modal.getByLabel('Position term ends').fill('2031-07-31');
                await modal.getByLabel('Requirements for the position').fill('Be a member for **2 years**.');
                await modal.getByRole('button', { name: 'Save changes' }).click();

                await expect(toast(page, 'Position is created.')).toBeVisible();
                // The service opened it, as its application period has started.
                await expect(page.getByRole('combobox', { name: `Status of ${positionName}` })).toHaveValue('open');
            });

            await test.step('a member applies for it, with a picture', async () => {
                await loginInBrowser(page, api, member.username);
                await page.goto(`/statutory/${event.url}`);
                await page.getByRole('link', { name: 'View candidates' }).click();
                await tableRows(positionsTable(page)).filter({ hasText: positionName }).getByRole('link', { name: 'Apply!' }).click();

                await expect(page.getByRole('heading', { name: `Apply for ${positionName}` })).toBeVisible();
                await expect(page.getByLabel('Body').getByRole('option')).toHaveText([body.name]);
                await page.getByLabel('Nationality').selectOption('Belgian');
                await page.getByRole('textbox', { name: 'Add a language' }).fill('English');
                await page.getByRole('textbox', { name: 'Add a language' }).press('Enter');
                for (const label of ['Studies', 'Attended Agorae', 'Attended EPMs', 'Attended European Events', 'European level experience',
                    'Local level experience', 'Position-related experience', 'Non-AEGEE experience', 'Program']) {
                    await page.getByLabel(label, { exact: true }).fill(`${label} of the e2e candidate`);
                }
                await page.getByLabel('Motivation', { exact: true }).fill('To help the **network**');
                await page.getByRole('checkbox', { name: /I agree for all my above mentioned personal data/ }).check();
                await page.getByRole('button', { name: 'Save candidature' }).click();

                await expect(toast(page, 'Candidate is saved.')).toBeVisible();
                await expect(page).toHaveURL(`/statutory/${event.url}/positions/approved`);
                await tableRows(positionsTable(page)).filter({ hasText: positionName }).getByRole('link', { name: 'Edit my application!' }).click();

                await expect(page.getByRole('heading', { name: `Edit the candidature for ${positionName}` })).toBeVisible();
                await page.getByLabel(/Choose a file/).setInputFiles({ name: 'candidate.png', mimeType: 'image/png', buffer: PICTURE });
                await page.getByRole('button', { name: 'Upload!' }).click();
                await expect(toast(page, 'Image is updated.')).toBeVisible();
                const [, positionId, candidateId] = /\/positions\/(\d+)\/candidates\/(\d+)\/edit$/.exec(page.url())!;
                const stored = await api.call<Envelope<{ image: { file_name: string } }>>(member.username, 'GET', `/api/statutory/events/${event.id}/positions/${positionId}/candidates/${candidateId}`);
                expectStatus(stored, 200);
                const fileName = stored.body.data.image.file_name;
                await expect(page.getByRole('img', { name: `Photo of ${candidateName}` })).toHaveAttribute('src', `/media/statutory/${fileName}`);
                // The service keeps the file where the web server serves /media/statutory from.
                expect(fs.readFileSync(path.join(serviceEnv('statutory').E2E_MEDIA_ROOT, 'statutory-media', fileName))).toEqual(PICTURE);
            });

            await test.step('the Juridical Commission approves the candidature', async () => {
                await loginInBrowser(page, api, 'board');
                await page.goto(`/statutory/${event.url}/positions/all`);
                await selectPosition(page, positionName);
                const candidates = page.getByRole('region', { name: 'Applications for selected position' }).getByRole('table');
                await expect(await cellOf(candidates, tableRows(candidates).filter({ hasText: member.last_name }), 'Email')).toHaveText(member.email);
                await page.getByRole('combobox', { name: `Status of ${candidateName}` }).selectOption('Approved');

                await expect(toast(page, `Successfully updated status of candidature for user #${member.id} to "approved"`)).toBeVisible();
            });

            await test.step('the member sees the approved candidature and can\'t edit it any more', async () => {
                await loginInBrowser(page, api, member.username);
                await page.goto(`/statutory/${event.url}/positions/approved`);
                const row = tableRows(positionsTable(page)).filter({ hasText: positionName });
                await expect(row.getByText('You cannot edit your application.')).toBeVisible();
                await expect(row.getByRole('link', { name: 'Edit my application!' })).toHaveCount(0);

                await selectPosition(page, positionName);
                await page.getByRole('button', { name: `View candidature of ${candidateName}` }).click();
                const modal = page.getByRole('dialog', { name: 'View candidature' });
                await expect(modal.getByRole('img', { name: `Photo of ${candidateName}` })).toHaveAttribute('src', /^\/media\/statutory\/.+\.png$/);
                await expect(modal.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Body', exact: true }) }).getByRole('cell')).toHaveText(body.name);
                await expect(modal.getByRole('strong')).toHaveText('network');
                // Every member sees the approved candidatures, without their addresses.
                await expect(modal.getByRole('rowheader', { name: 'Email' })).toHaveCount(0);
            });

            await test.step('the Juridical Commission exports the approved candidatures', async () => {
                await loginInBrowser(page, api, 'board');
                await page.goto(`/statutory/${event.url}/positions/all`);
                await page.getByRole('link', { name: 'Export candidates' }).click();
                await expect(page.getByRole('heading', { name: 'Export candidates', exact: true })).toBeVisible();

                // Every column is chosen at first.
                await expect(page.getByRole('checkbox', { name: 'Number of EPMs visited' })).toBeChecked();
                for (const column of await page.getByRole('checkbox').all()) {
                    await column.uncheck();
                }
                for (const column of ['First name', 'Last name', 'Email', 'Position', 'Body name', 'Status']) {
                    await page.getByRole('checkbox', { name: column, exact: true }).check();
                }
                await page.getByLabel('Filter on candidate status').selectOption('Approved candidates');
                const download = page.waitForEvent('download');
                await page.getByRole('button', { name: 'Export candidates data' }).click();

                const rows = spreadsheetRows(fs.readFileSync(await (await download).path()));
                expect(rows).toEqual([
                    ['First name', 'Last name', 'Email', 'Position', 'Body name', 'Status'],
                    [member.first_name, member.last_name, member.email, positionName, body.name, 'approved']
                ]);
            });
        } finally {
            await leaveCommission();
        }
    });
});
