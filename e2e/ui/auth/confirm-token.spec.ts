// The page that confirms the email address of a new account (/confirm_signup), opened from the
// link in the confirmation mail.
import { forbidden, notFound } from '../support/factories/base.ts';
import { toast } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { test, expect } from '../support/test.ts';

const CONFIRMED = { success: true, message: 'Your profile is activated.' };

test.describe('confirming the email of a new account', () => {
    test.use({ session: 'anonymous' });

    test('the link from the mail fills in the token, and nothing is sent before the button is pressed', async ({ page, api }) => {
        api.json('POST core /confirm-email', CONFIRMED);
        await page.goto('/confirm_signup?token=mail-token');

        await expect(page.getByLabel('Token')).toHaveValue('mail-token');
        await expect(page).toHaveTitle('MyAEGEE | Confirm your email');
        expect(api.callsTo('POST core /confirm-email')).toEqual([]);

        await page.getByRole('button', { name: 'Confirm your email' }).click();

        await expect(toast(page, 'Your email is verified.')).toBeVisible();
        await expect(page).toHaveURL('/login');
        expect(api.callsTo('POST core /confirm-email').map((call) => call.body)).toEqual([{ token: 'mail-token' }]);
    });

    test('a token typed by hand is sent as typed, and an empty field is not sent', async ({ page, api }) => {
        api.json('POST core /confirm-email', CONFIRMED);
        await page.goto('/confirm_signup');
        const token = page.getByLabel('Token');

        await page.getByRole('button', { name: 'Confirm your email' }).click();
        expect(await token.evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
        expect(api.callsTo('POST core /confirm-email')).toEqual([]);

        await token.fill('typed-token');
        await page.getByRole('button', { name: 'Confirm your email' }).click();

        await expect(page).toHaveURL('/login');
        expect(api.callsTo('POST core /confirm-email').map((call) => call.body)).toEqual([{ token: 'typed-token' }]);
    });

    test('an unknown token is called invalid', async ({ page, api }) => {
        api.on('POST core /confirm-email', { status: 404, json: notFound('The token is invalid.') });
        await page.goto('/confirm_signup?token=unknown');

        await page.getByRole('button', { name: 'Confirm your email' }).click();

        await expect(toast(page, 'The token is invalid.')).toBeVisible();
        await expect(page).toHaveURL('/confirm_signup?token=unknown');
    });

    test('an expired token gets core\'s message', async ({ page, api }) => {
        api.on('POST core /confirm-email', { status: 403, json: forbidden('The token has expired.') });
        await page.goto('/confirm_signup?token=old');

        await page.getByRole('button', { name: 'Confirm your email' }).click();

        await expect(toast(page, 'Could not confirm email: The token has expired.')).toBeVisible();
    });

    test.describe('logged in', () => {
        test.use({ session: 'member' });

        test('a member who confirms an address ends on the dashboard', async ({ page, api }) => {
            api.fallback(mockEverything);
            api.json('POST core /confirm-email', CONFIRMED);
            await page.goto('/confirm_signup?token=mail-token');

            await page.getByRole('button', { name: 'Confirm your email' }).click();

            await expect(toast(page, 'Your email is verified.')).toBeVisible();
            await expect(page).toHaveURL('/dashboard');
            await expect(toast(page, /Could not confirm email/)).toHaveCount(0);
        });
    });
});
