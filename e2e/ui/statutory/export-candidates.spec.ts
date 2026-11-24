// Exporting the candidatures of an Agora (/statutory/:id/positions/export): which columns, which
// candidatures, and the spreadsheet that is downloaded.
import fs from 'node:fs';

import type { Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { forbidden, notFound, ok } from '../support/factories/base.ts';
import { candidateFields } from '../support/factories/statutory-candidates.ts';
import { statutoryEvent, statutoryEventPermissions } from '../support/factories/statutory-events.ts';
import { freezeTime, toast } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { test, expect } from '../support/test.ts';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
// What the service sends is a spreadsheet; the page only hands it on.
const SPREADSHEET = Buffer.from('PK spreadsheet of the candidatures');
const FIELDS = candidateFields();
const KEYS = Object.keys(FIELDS);

const mockPage = (api: ApiMock, fields: Record<string, string> = FIELDS): void => {
    api.json('GET statutory /events/:id', ok(statutoryEvent({ id: 1, url: 'agora-spring', permissions: statutoryEventPermissions({ manage_candidates: true }) })));
    api.json('GET statutory /events/:id/fields/candidates', ok(fields));
};
const answerExport = (api: ApiMock): void => {
    api.on('GET statutory /events/:id/positions/export', { body: SPREADSHEET, contentType: XLSX });
};

const exportButton = (page: Page) => page.getByRole('button', { name: 'Export candidates data' });
const exported = (api: ApiMock) => api.callsTo('GET statutory /events/:id/positions/export')
    .map(({ params, query }) => ({ id: params.id, select: query.getAll('select[]'), status: query.get('filter[status]') }));

test.describe('exporting the candidatures of an Agora', () => {
    test('every column is chosen at first, for every candidature', async ({ page, api }) => {
        mockPage(api);
        // The export page, not a list of positions called "export".
        await page.goto('/statutory/agora-spring/positions/export');

        await expect(page.getByRole('heading', { name: 'Export candidates', exact: true })).toBeVisible();
        await expect(page).toHaveTitle('MyAEGEE | Export candidates for statutory event');
        await expect(page.getByLabel('Filter on candidate status')).toHaveValue('');
        await expect(page.getByLabel('Filter on candidate status').getByRole('option'))
            .toHaveText(['Everybody', 'Approved candidates', 'Rejected candidates', 'Pending candidates']);
        await expect(page.getByRole('checkbox')).toHaveCount(KEYS.length);
        for (const label of ['First name', 'Email', 'Position', 'Number of EPMs visited', 'Status']) {
            await expect(page.getByRole('checkbox', { name: label, exact: true })).toBeChecked();
        }
        await expect(exportButton(page)).toBeEnabled();
        expect(api.callsTo('GET statutory /events/:id/fields/candidates').map((call) => call.params.id)).toEqual(['agora-spring']);
    });

    test('downloads the spreadsheet of every column and candidature', async ({ page, api }) => {
        await freezeTime(page);
        mockPage(api);
        answerExport(api);
        await page.goto('/statutory/agora-spring/positions/export');

        const download = page.waitForEvent('download');
        await exportButton(page).click();

        const file = await download;
        // Named after the moment of the export (the browser turns the colons into underscores).
        expect(file.suggestedFilename()).toMatch(/^candidates_2027-03-01T09_00_0\d\.\d{3}Z\.xlsx$/);
        expect(fs.readFileSync(await file.path())).toEqual(SPREADSHEET);
        expect(exported(api)).toEqual([{ id: 'agora-spring', select: KEYS, status: null }]);
        await expect(exportButton(page)).toBeEnabled();
    });

    test('downloads the chosen columns of the pending candidatures', async ({ page, api }) => {
        mockPage(api);
        answerExport(api);
        await page.goto('/statutory/agora-spring/positions/export');

        await page.getByRole('checkbox', { name: 'Email', exact: true }).uncheck();
        await page.getByRole('checkbox', { name: 'Date of birth', exact: true }).uncheck();
        await page.getByLabel('Filter on candidate status').selectOption('Pending candidates');
        const download = page.waitForEvent('download');
        await exportButton(page).click();
        await download;

        expect(exported(api)).toEqual([{
            id: 'agora-spring',
            select: KEYS.filter((key) => !['notification_email', 'date_of_birth'].includes(key)),
            status: 'pending'
        }]);
    });

    test('downloads the approved and the rejected candidatures', async ({ page, api }) => {
        mockPage(api);
        answerExport(api);
        await page.goto('/statutory/agora-spring/positions/export');

        for (const option of ['Approved candidates', 'Rejected candidates']) {
            await page.getByLabel('Filter on candidate status').selectOption(option);
            const download = page.waitForEvent('download');
            await exportButton(page).click();
            await download;
        }

        // The statuses a candidature has.
        expect(exported(api).map(({ status }) => status)).toEqual(['approved', 'rejected']);
    });

    test('nothing is exported without a column', async ({ page, api }) => {
        mockPage(api, { first_name: 'First name', last_name: 'Last name' });
        await page.goto('/statutory/agora-spring/positions/export');

        await page.getByRole('checkbox', { name: 'First name' }).uncheck();
        await expect(exportButton(page)).toBeEnabled();
        await page.getByRole('checkbox', { name: 'Last name' }).uncheck();

        await expect(exportButton(page)).toBeDisabled();
        expect(api.callsTo('GET statutory /events/:id/positions/export')).toHaveLength(0);
    });

    test('a page without columns offers nothing to export', async ({ page, api }) => {
        mockPage(api, {});
        await page.goto('/statutory/agora-spring/positions/export');

        await expect(page.getByLabel('Filter on candidate status')).toBeVisible();
        await expect(page.getByRole('checkbox')).toHaveCount(0);
        await expect(exportButton(page)).toBeDisabled();
    });

    test('the button is busy while the spreadsheet is made', async ({ page, api }) => {
        mockPage(api);
        api.on('GET statutory /events/:id/positions/export', { body: SPREADSHEET, contentType: XLSX, delayMs: 1000 });
        await page.goto('/statutory/agora-spring/positions/export');

        const download = page.waitForEvent('download');
        await exportButton(page).click();

        await expect(exportButton(page)).toBeDisabled();
        await download;
        await expect(exportButton(page)).toBeEnabled();
        expect(api.callsTo('GET statutory /events/:id/positions/export')).toHaveLength(1);
    });

    test('says why the candidatures could not be exported', async ({ page, api }) => {
        mockPage(api);
        api.on('GET statutory /events/:id/positions/export', { status: 403, json: forbidden('You are not allowed to export candidates.') });
        await page.goto('/statutory/agora-spring/positions/export');

        await exportButton(page).click();

        await expect(toast(page, 'Could not export candidates: You are not allowed to export candidates.')).toBeVisible();
        await expect(exportButton(page)).toBeEnabled();
    });

    test('says when the export failed without a reason', async ({ page, api }) => {
        mockPage(api);
        api.on('GET statutory /events/:id/positions/export', { status: 502, body: '<html>Bad gateway</html>', contentType: 'text/html' });
        await page.goto('/statutory/agora-spring/positions/export');

        await exportButton(page).click();

        await expect(toast(page, 'Could not export candidates: Request failed with status code 502')).toBeVisible();
    });

    test('says when the service can\'t be reached', async ({ page, api }) => {
        mockPage(api);
        api.on('GET statutory /events/:id/positions/export', { abort: 'failed' });
        await page.goto('/statutory/agora-spring/positions/export');

        await exportButton(page).click();

        await expect(toast(page, 'Could not export candidates: Network Error')).toBeVisible();
        await expect(exportButton(page)).toBeEnabled();
    });

    test('an unknown event goes back to the list of statutory events', async ({ page, api }) => {
        api.fallback(mockEverything);
        api.on('GET statutory /events/:id', { status: 404, json: notFound('Event with such url or ID is not found.') });
        await page.goto('/statutory/nope/positions/export');

        await expect(toast(page, 'Event is not found')).toBeVisible();
        await expect(page).toHaveURL('/statutory');
    });

    test('columns that can\'t be loaded go back to the list of statutory events', async ({ page, api }) => {
        api.fallback(mockEverything);
        mockPage(api);
        api.on('GET statutory /events/:id/fields/candidates', { status: 500, json: { success: false, message: 'Database is down' } });
        await page.goto('/statutory/agora-spring/positions/export');

        await expect(toast(page, 'Some error happened: Database is down')).toBeVisible();
        await expect(page).toHaveURL('/statutory');
    });
});
