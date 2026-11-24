// The bug report page (/bug_report): a form that sends a bug, with up to three screenshots, to
// core, which files it in the issue tracker. Visitors and members.
import type { Page } from '@playwright/test';

import { openAccountMenu, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

// A one-pixel PNG: what a screenshot is doesn't matter here, only that one is sent.
const ONE_PIXEL_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const REPORTED = { json: { success: true, message: 'Your issue is reported.' } };
const shot = (name: string) => ({ name, mimeType: 'image/png', buffer: ONE_PIXEL_PNG });

const send = (page: Page) => page.getByRole('button', { name: 'Send bug report' });

const describeBug = async (page: Page): Promise<void> => {
    await page.getByLabel('What is happening?').fill('The calendar is empty');
    await page.getByLabel('Describe what\'s wrong and how it should work').fill('No events show up in March.');
};

test.describe('reporting a bug as a visitor', () => {
    test.use({ session: 'anonymous' });

    test('the page keeps the screen\'s width, so the account menu stays in reach', async ({ page, layout }) => {
        await page.goto('/bug_report');
        await page.getByLabel('Screenshot 1', { exact: true }).setInputFiles(shot('a-screenshot-with-a-long-name.png'));
        await expect(page.getByText('a-screenshot-with-a-long-name.png')).toBeVisible();

        // On a phone the remove button goes under the file field instead of widening the page.
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
        const account = await openAccountMenu(page, layout);
        await expect(account.getByRole('link', { name: 'Login', exact: true })).toBeVisible();
    });

    test('sends the description, the email and two screenshots, and empties the form', async ({ page, api }) => {
        api.on('POST core /bug-report', REPORTED);
        await page.goto('/bug_report/');

        await describeBug(page);
        await page.getByLabel('Your email').fill('visitor@example.com');
        await expect(page.getByText('Not set.')).toBeVisible();
        await page.getByLabel('Screenshot 1', { exact: true }).setInputFiles(shot('calendar.png'));
        await page.getByRole('button', { name: 'Add screenshot' }).click();
        await page.getByLabel('Screenshot 2', { exact: true }).setInputFiles(shot('menu.png'));
        await expect(page.getByText('calendar.png')).toBeVisible();
        await send(page).click();

        await expect(toast(page, 'Your issue is reported.')).toBeVisible();
        const [call] = api.callsTo('POST core /bug-report');
        expect(call.contentType).toMatch(/^multipart\/form-data/);
        expect(call.parts).toEqual([
            { name: 'summary', value: 'The calendar is empty' },
            { name: 'description', value: 'No events show up in March.' },
            { name: 'email', value: 'visitor@example.com' },
            { name: 'screenshots', filename: 'calendar.png', contentType: 'image/png' },
            { name: 'screenshots', filename: 'menu.png', contentType: 'image/png' }
        ]);

        // Ready for the next one: empty fields and one empty screenshot.
        await expect(page.getByLabel('What is happening?')).toHaveValue('');
        await expect(page.getByLabel('Describe what\'s wrong and how it should work')).toHaveValue('');
        await expect(page.getByLabel('Your email')).toHaveValue('');
        await expect(page.getByLabel('Screenshot 1', { exact: true })).toHaveValue('');
        await expect(page.getByLabel('Screenshot 2', { exact: true })).toHaveCount(0);
        await expect(page.getByText('Not set.')).toBeVisible();
    });

    test('asks to choose every screenshot first; without screenshots it sends the report', async ({ page, api }) => {
        api.on('POST core /bug-report', REPORTED);
        await page.goto('/bug_report/');
        await describeBug(page);
        await page.getByLabel('Your email').fill('visitor@example.com');

        await send(page).click();

        await expect(toast(page, 'Please select all the files.')).toBeVisible();
        expect(api.callsTo('POST core /bug-report')).toHaveLength(0);

        await page.getByRole('button', { name: 'Remove screenshot 1' }).click();
        await expect(page.getByLabel('Screenshot 1', { exact: true })).toHaveCount(0);
        await send(page).click();

        await expect(toast(page, 'Your issue is reported.')).toBeVisible();
        expect(api.callsTo('POST core /bug-report').map((call) => call.parts.map((part) => part.name))).toEqual([['summary', 'description', 'email']]);
    });

    test('takes three screenshots at most', async ({ page }) => {
        await page.goto('/bug_report/');
        const add = page.getByRole('button', { name: 'Add screenshot' });

        await add.click();
        await add.click();

        await expect(page.getByLabel(/^Screenshot \d$/)).toHaveCount(3);
        await expect(add).toBeDisabled();

        await page.getByRole('button', { name: 'Remove screenshot 2' }).click();
        await expect(page.getByLabel(/^Screenshot \d$/)).toHaveCount(2);
        await expect(add).toBeEnabled();
    });

    test('refuses a screenshot over 5 MB', async ({ page }) => {
        await page.goto('/bug_report/');

        await page.getByLabel('Screenshot 1', { exact: true }).setInputFiles({ name: 'huge.png', mimeType: 'image/png', buffer: Buffer.alloc(6 * 1024 * 1024) });

        await expect(toast(page, 'The screenshot should be at most 5 MB.')).toBeVisible();
        await expect(page.getByLabel('Screenshot 1', { exact: true })).toHaveValue('');
        await expect(page.getByText('Not set.')).toBeVisible();
        await expect(page.getByText('huge.png')).toHaveCount(0);
    });

    test('cannot be sent twice while it is being sent', async ({ page, api }) => {
        let release = (): void => {};
        const held = new Promise<void>((resolve) => { release = resolve; });
        api.on('POST core /bug-report', async () => { await held; return REPORTED; });
        await page.goto('/bug_report/');
        await describeBug(page);
        await page.getByLabel('Your email').fill('visitor@example.com');
        await page.getByRole('button', { name: 'Remove screenshot 1' }).click();

        await send(page).click();

        await expect(send(page)).toBeDisabled();
        release();
        await expect(toast(page, 'Your issue is reported.')).toBeVisible();
        await expect(send(page)).toBeEnabled();
        expect(api.callsTo('POST core /bug-report')).toHaveLength(1);
    });

    test('shows why core refused the report and keeps what was typed', async ({ page, api }) => {
        api.on('POST core /bug-report', { status: 429, json: { success: false, message: 'You have sent too many bug reports, please try again later.' } });
        await page.goto('/bug_report/');
        await describeBug(page);
        await page.getByLabel('Your email').fill('visitor@example.com');
        await page.getByLabel('Screenshot 1', { exact: true }).setInputFiles(shot('calendar.png'));

        await send(page).click();

        await expect(toast(page, 'There was an error reporting your issue: You have sent too many bug reports, please try again later.')).toBeVisible();
        await expect(page.getByLabel('What is happening?')).toHaveValue('The calendar is empty');
        await expect(page.getByLabel('Your email')).toHaveValue('visitor@example.com');
        await expect(page.getByText('calendar.png')).toBeVisible();
        await expect(send(page)).toBeEnabled();
    });

    test('the browser asks for the fields that are required', async ({ page, api }) => {
        await page.goto('/bug_report/');
        await page.getByRole('button', { name: 'Remove screenshot 1' }).click();

        await send(page).click();

        for (const label of ['What is happening?', 'Describe what\'s wrong and how it should work', 'Your email']) {
            expect(await page.getByLabel(label).evaluate((field: HTMLInputElement) => field.validity.valueMissing), label).toBe(true);
        }
        expect(api.callsTo('POST core /bug-report')).toHaveLength(0);
    });
});

test.describe('reporting a bug as a member', () => {
    test('needs no email: the member\'s notification address is sent', async ({ page, api, me }) => {
        me!.notification_email = 'alex.notifications@example.com';
        api.on('POST core /bug-report', REPORTED);
        await page.goto('/bug_report/');

        await describeBug(page);
        await expect(page.getByLabel('Your email')).toHaveCount(0);
        await page.getByLabel('Screenshot 1', { exact: true }).setInputFiles(shot('calendar.png'));
        await send(page).click();

        await expect(toast(page, 'Your issue is reported.')).toBeVisible();
        expect(api.callsTo('POST core /bug-report').map((call) => call.parts.find((part) => part.name === 'email'))).toEqual([
            { name: 'email', value: 'alex.notifications@example.com' }
        ]);
    });
});
