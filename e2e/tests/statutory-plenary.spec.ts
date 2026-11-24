// The plenaries of an Agora against the real services: the chair (core permissions
// `global:manage_plenaries:agora` and `global:mark_attendance:agora`) creates a plenary around
// now, marks an accepted delegate in and out by their statutory id, and exports the statistics.
// The detailed behaviour of each page is covered by the mocked-API suite in ui/statutory/.
import fs from 'node:fs';

import type { Page } from '@playwright/test';

import type { Envelope } from '../support/api.ts';
import { test, expect, expectStatus, loginInBrowser } from '../support/api.ts';
import { acceptedDelegate, makeChair } from '../support/statutory-plenaries-data.ts';
import { cellOf, dialog, fillDate, tableRows, toast } from '../ui/support/shell.ts';

// A moment `minutes` from now as the date pickers show it, in the browser's time zone.
const pickerTime = (page: Page, minutes: number): Promise<string> => page.evaluate((offset) => {
    const at = new Date(Date.now() + offset * 60 * 1000);
    const two = (value: number) => String(value).padStart(2, '0');
    return `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())} ${two(at.getHours())}:${two(at.getMinutes())}`;
}, minutes);

test.describe('plenaries of an Agora', () => {
    test('the chair creates a plenary, marks a delegate in and out, and exports the statistics', async ({ api, page }) => {
        const removeChair = await makeChair(api, 'chair');
        try {
            const event = await api.createStatutoryEvent();
            expectStatus(await api.call('admin', 'PUT', `/api/statutory/events/${event.id}/status`, { status: 'published' }), 200);
            const delegate = await acceptedDelegate(api, event, 'member');
            const member = await api.me('member');
            const name = `${member.first_name} ${member.last_name}`;
            await loginInBrowser(page, api, 'chair');

            await test.step('the chair creates a plenary that is going on now', async () => {
                await page.goto(`/statutory/${event.url}/plenaries`);
                await page.getByRole('button', { name: 'Create a plenary' }).click();
                const form = dialog(page, 'Add plenary');
                await form.getByLabel('Name').fill('Opening plenary');
                await fillDate(form.getByLabel('Starts'), await pickerTime(page, -60));
                await fillDate(form.getByLabel('Ends'), await pickerTime(page, 60));
                await form.getByRole('button', { name: 'Save changes' }).click();

                await expect(toast(page, 'Plenary is created.')).toBeVisible();
                await expect(form).toHaveCount(0);
                await tableRows(page.getByRole('table')).filter({ hasText: 'Opening plenary' }).getByRole('link', { name: 'View/mark attendances' }).click();
                await expect(page.getByRole('listitem').filter({ hasText: 'Name:' })).toHaveText('Name: Opening plenary');
            });

            await test.step('the delegate is marked in and out by their statutory id', async () => {
                const field = page.getByLabel('Application ID or statutory ID');
                await field.fill(delegate.statutory_id);
                await field.press('Enter');

                await expect(toast(page, `Successfully marked application ${delegate.id} as present.`)).toBeVisible();
                const table = page.getByRole('table');
                const row = tableRows(table).filter({ hasText: name });
                await expect(await cellOf(table, row, 'Application ID')).toHaveText(String(delegate.id));
                await expect(await cellOf(table, row, 'Ends')).toHaveText('');

                await field.fill(delegate.statutory_id);
                await field.press('Enter');

                await expect(toast(page, `Successfully marked application ${delegate.id} as left.`)).toBeVisible();
                await expect(await cellOf(table, row, 'Ends')).toHaveText(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);
            });

            await test.step('the statistics are exported as a spreadsheet', async () => {
                await page.goto(`/statutory/${event.url}/plenaries`);
                const download = page.waitForEvent('download');
                await page.getByRole('button', { name: 'Export stats' }).click();

                const file = await download;
                expect(file.suggestedFilename()).toMatch(/^plenaries_.*\.xlsx$/);
                // An xlsx file is a zip archive.
                expect(fs.readFileSync(await file.path()).subarray(0, 2).toString()).toBe('PK');
            });

            await test.step('nobody is marked at a plenary that is over', async () => {
                const over = await api.call<Envelope<{ id: number }>>('chair', 'POST', `/api/statutory/events/${event.id}/plenaries`, {
                    name: 'Yesterday\'s plenary',
                    starts: new Date(Date.now() - 26 * 60 * 60 * 1000),
                    ends: new Date(Date.now() - 24 * 60 * 60 * 1000)
                });
                expectStatus(over, 200);

                const marked = await api.call<{ message: string }>('chair', 'POST', `/api/statutory/events/${event.id}/plenaries/${over.body.data.id}/attendance/mark`, {
                    application_id: delegate.statutory_id
                });
                expectStatus(marked, 403);
                expect(marked.body.message).toBe('The plenary is over already, cannot mark any more members.');
            });
        } finally {
            await removeChair();
        }
    });
});
