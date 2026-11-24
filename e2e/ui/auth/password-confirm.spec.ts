// The page that sets a new password (/password_confirm), opened from the link in the password
// reset mail.
import { notFound, validationError } from '../support/factories/base.ts';
import { toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const CHANGED = { success: true, message: 'The password was changed.' };

test.describe('setting a new password', () => {
    test.use({ session: 'anonymous' });

    test('the link fills in the token; a new password typed twice is sent and leads to the login page', async ({ page, api }) => {
        api.json('POST core /password_confirm', CHANGED);
        await page.goto('/password_confirm?token=reset-token');
        await expect(page.getByLabel('Token')).toHaveValue('reset-token');

        await page.getByLabel('Password', { exact: true }).fill('new-password-1');
        await page.getByLabel('Password confirmation').fill('new-password-1');
        await page.getByRole('button', { name: 'Confirm password' }).click();

        await expect(toast(page, 'Password is changed.')).toBeVisible();
        await expect(page).toHaveURL('/login');
        expect(api.callsTo('POST core /password_confirm').map((call) => call.body)).toEqual([{ token: 'reset-token', password: 'new-password-1' }]);
    });

    test('two different passwords are caught before sending', async ({ page, api }) => {
        await page.goto('/password_confirm?token=reset-token');

        await page.getByLabel('Password', { exact: true }).fill('new-password-1');
        await page.getByLabel('Password confirmation').fill('new-password-2');
        await page.getByRole('button', { name: 'Confirm password' }).click();

        await expect(page.getByText('Passwords do not match.')).toBeVisible();
        expect(api.callsTo('POST core /password_confirm')).toEqual([]);
    });

    test('core\'s validation errors appear under the token and the password', async ({ page, api }) => {
        api.on('POST core /password_confirm', {
            status: 422,
            json: validationError({ token: ['Token should be set.'], password: ['Password should be at least 8 characters long.'] })
        });
        await page.goto('/password_confirm?token=reset-token');

        await page.getByLabel('Password', { exact: true }).fill('new-password-1');
        await page.getByLabel('Password confirmation').fill('new-password-1');
        await page.getByRole('button', { name: 'Confirm password' }).click();

        await expect(toast(page, 'Some of the password data is invalid.')).toBeVisible();
        await expect(page.getByText('Token should be set.')).toBeVisible();
        await expect(page.getByText('Password should be at least 8 characters long.')).toBeVisible();
        await expect(page).toHaveURL('/password_confirm?token=reset-token');
    });

    test('an expired token says it expired, and an unknown one that it is invalid', async ({ page, api }) => {
        api.on('POST core /password_confirm', { status: 404, json: notFound('Token is expired.') });
        await page.goto('/password_confirm?token=old');
        await page.getByLabel('Password', { exact: true }).fill('new-password-1');
        await page.getByLabel('Password confirmation').fill('new-password-1');

        await page.getByRole('button', { name: 'Confirm password' }).click();
        await expect(toast(page, 'Could not change password: Token is expired.')).toBeVisible();

        api.on('POST core /password_confirm', { status: 404, json: notFound('Token is invalid.') });
        await page.getByLabel('Token').fill('unknown');
        await page.getByRole('button', { name: 'Confirm password' }).click();
        await expect(toast(page, 'Could not change password: Token is invalid.')).toBeVisible();
    });

    test('another error shows core\'s message', async ({ page, api }) => {
        api.on('POST core /password_confirm', { status: 500, json: { success: false, message: 'Database is down' } });
        await page.goto('/password_confirm?token=reset-token');
        await page.getByLabel('Password', { exact: true }).fill('new-password-1');
        await page.getByLabel('Password confirmation').fill('new-password-1');

        await page.getByRole('button', { name: 'Confirm password' }).click();

        await expect(toast(page, 'Could not change password: Database is down')).toBeVisible();
    });

    test('a password of seven characters is not sent, and both eye buttons show what was typed', async ({ page, api }) => {
        await page.goto('/password_confirm?token=reset-token');
        const password = page.getByLabel('Password', { exact: true });
        const confirmation = page.getByLabel('Password confirmation');

        await password.fill('1234567');
        await confirmation.fill('1234567');
        await page.getByRole('button', { name: 'Confirm password' }).click();
        expect(await password.evaluate((input: HTMLInputElement) => input.validity.tooShort)).toBe(true);
        expect(api.callsTo('POST core /password_confirm')).toEqual([]);

        await page.getByRole('button', { name: 'Show password' }).first().click();
        await expect(password).toHaveAttribute('type', 'text');
        await expect(confirmation).toHaveAttribute('type', 'password');
        await page.getByRole('button', { name: 'Show password' }).click();
        await expect(confirmation).toHaveAttribute('type', 'text');
        await expect(page.getByRole('button', { name: 'Hide password' })).toHaveCount(2);
    });

    test('"I don\'t have a token" leads back to the reset, and the advice opens in a new tab', async ({ page }) => {
        await page.goto('/password_confirm');

        for (const name of ['strong password', 'password manager.']) {
            await expect(page.getByRole('link', { name })).toHaveAttribute('target', '_blank');
            await expect(page.getByRole('link', { name })).toHaveAttribute('rel', 'noopener noreferrer');
        }

        await page.getByRole('link', { name: 'I don\'t have a token' }).click();
        await expect(page).toHaveURL('/password_reset');
    });
});
