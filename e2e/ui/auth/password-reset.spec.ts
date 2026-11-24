// The page that asks for a password reset (/password_reset): core mails a link to the address
// if it belongs to an account, and answers the same either way.
import { badRequest } from '../support/factories/base.ts';
import { toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const REQUESTED = { success: true, message: 'If this email belongs to an account, a password reset was sent to it.' };

test.describe('asking for a password reset', () => {
    test.use({ session: 'anonymous' });

    test('sends the address and moves on to the page for the new password', async ({ page, api }) => {
        api.json('POST core /password_reset', REQUESTED);
        await page.goto('/password_reset');
        await expect(page).toHaveTitle('MyAEGEE | Reset your password');

        await page.getByLabel('Email').fill('member@example.com');
        await page.getByRole('button', { name: 'Reset password' }).click();

        // The same for an address without an account: core doesn't tell.
        await expect(toast(page, REQUESTED.message)).toBeVisible();
        await expect(page).toHaveURL('/password_confirm');
        expect(api.callsTo('POST core /password_reset').map((call) => call.body)).toEqual([{ email: 'member@example.com' }]);
    });

    test('an error shows core\'s message', async ({ page, api }) => {
        api.on('POST core /password_reset', { status: 400, json: badRequest('Email should be a string.') });
        await page.goto('/password_reset');

        await page.getByLabel('Email').fill('member@example.com');
        await page.getByRole('button', { name: 'Reset password' }).click();

        await expect(toast(page, 'Could not reset password: Email should be a string.')).toBeVisible();
        await expect(page).toHaveURL('/password_reset');
    });

    test('an empty or malformed address is not sent', async ({ page, api }) => {
        await page.goto('/password_reset');
        const email = page.getByLabel('Email');

        await page.getByRole('button', { name: 'Reset password' }).click();
        expect(await email.evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);

        await email.fill('not an address');
        await page.getByRole('button', { name: 'Reset password' }).click();
        expect(await email.evaluate((input: HTMLInputElement) => input.validity.typeMismatch)).toBe(true);

        expect(api.callsTo('POST core /password_reset')).toEqual([]);
    });

    test('"Confirm password" leads to the page for the new password', async ({ page }) => {
        await page.goto('/password_reset');

        await page.getByRole('link', { name: 'Confirm password' }).click();

        await expect(page).toHaveURL('/password_confirm');
        await expect(page).toHaveTitle('MyAEGEE | Confirm your password');
    });
});
