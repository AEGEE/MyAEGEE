// Changing one's own password (/members/edituser), reached from "Change password" on one's
// own profile.
import type { Page } from '@playwright/test';

import { ok, validationError } from '../support/factories/base.ts';
import { permissionsFor, toast } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { test, expect } from '../support/test.ts';

const oldPassword = (page: Page) => page.getByLabel('Old password');
const newPassword = (page: Page) => page.getByLabel('New password');
const confirmation = (page: Page) => page.getByLabel('Confirm your password');
const save = (page: Page) => page.getByRole('button', { name: 'Save user' });

const fillPasswords = async (page: Page, old: string, next: string, again = next) => {
    await oldPassword(page).fill(old);
    await newPassword(page).fill(next);
    await confirmation(page).fill(again);
};

test.describe('changing the password', () => {
    test('goes to the members list when the own profile cannot be loaded', async ({ page, api, me }) => {
        // The app knows who is logged in; the page's own request for it fails.
        let asked = 0;
        api.on('GET core /members/me', () => {
            asked += 1;
            return asked === 1 ? { json: ok(me) } : { status: 500, json: { success: false, message: 'Something went wrong on the server.' } };
        });
        api.fallback(mockEverything);

        await page.goto('/members/edituser');

        await expect(toast(page, 'Some error happened: Something went wrong on the server.')).toBeVisible();
        await expect(page).toHaveURL('/members');
    });

    test('changes the password and goes to the own profile', async ({ page, api, me }) => {
        api.on('PUT core /members/:id/password', { json: { success: true, message: 'The password was changed.' }, delayMs: 500 });
        // The own profile that comes after.
        permissionsFor(api, 'members', 'me', []);
        permissionsFor(api, 'bodies', 1, []);
        await page.goto('/members/edituser');

        await fillPasswords(page, 'the old one', 'a new password');
        await save(page).click();

        // No second click while it is saved.
        await expect(save(page)).toBeDisabled();
        await expect(toast(page, 'Password is updated.')).toBeVisible();
        await expect(page).toHaveURL('/members/me');
        await expect(page.getByText(me!.first_name, { exact: true })).toBeVisible();
        await expect.poll(() => api.callsTo('PUT core /members/:id/password').map((call) => [call.params.id, call.body]))
            .toEqual([['me', { old_password: 'the old one', password: 'a new password' }]]);
    });

    test('refuses passwords that do not match, without asking the server', async ({ page, api }) => {
        await page.goto('/members/edituser');

        await fillPasswords(page, 'the old one', 'a new password', 'another password');
        await save(page).click();

        await expect(page.getByText('Passwords do not match.')).toBeVisible();
        expect(api.callsTo('PUT core /members/:id/password')).toHaveLength(0);
    });

    test('asks for the old password first', async ({ page, api }) => {
        await page.goto('/members/edituser');

        await newPassword(page).fill('a new password');
        await confirmation(page).fill('a new password');
        await save(page).click();

        await expect(page.getByText('Please type in your old password')).toBeVisible();
        expect(api.callsTo('PUT core /members/:id/password')).toHaveLength(0);
    });

    test('says so when the old password is wrong', async ({ page, api }) => {
        api.on('PUT core /members/:id/password', { status: 422, json: { success: false, message: 'The old password is invalid.' } });
        await page.goto('/members/edituser');

        await fillPasswords(page, 'not the old one', 'a new password');
        await save(page).click();

        await expect(toast(page, 'Some of the user data is invalid.')).toBeVisible();
        await expect(page.getByText('Wrong password.')).toBeVisible();
        await expect(page).toHaveURL('/members/edituser');
        await expect(save(page)).toBeEnabled();
    });

    test('shows what the server says about each field', async ({ page, api }) => {
        api.on('PUT core /members/:id/password', {
            status: 422,
            json: validationError({ password: ['Password should be set.'] })
        });
        await page.goto('/members/edituser');

        // Long enough for the field, but core counts only spaces as no password.
        await fillPasswords(page, 'the old one', '        ');
        await save(page).click();

        await expect(toast(page, 'Some of the user data is invalid.')).toBeVisible();
        await expect(page.getByText('Password should be set.')).toBeVisible();
    });

    test('shows the server message when saving fails otherwise', async ({ page, api }) => {
        api.on('PUT core /members/:id/password', { status: 500, json: { success: false, message: 'Something went wrong on the server.' } });
        await page.goto('/members/edituser');

        await fillPasswords(page, 'the old one', 'a new password');
        await save(page).click();

        await expect(toast(page, 'Could not save user: Something went wrong on the server.')).toBeVisible();
        await expect(page).toHaveURL('/members/edituser');
    });

    test('the eye button shows and hides a password', async ({ page }) => {
        await page.goto('/members/edituser');
        await newPassword(page).fill('a new password');
        await expect(newPassword(page)).toHaveAttribute('type', 'password');

        // The second of the three fields.
        await page.getByRole('button', { name: 'Show password' }).nth(1).click();

        await expect(newPassword(page)).toHaveAttribute('type', 'text');
        await expect(oldPassword(page)).toHaveAttribute('type', 'password');
        await page.getByRole('button', { name: 'Hide password' }).click();
        await expect(newPassword(page)).toHaveAttribute('type', 'password');
    });

    test('the browser refuses a password shorter than 8 characters', async ({ page, api }) => {
        await page.goto('/members/edituser');

        await fillPasswords(page, 'the old one', 'short12');
        await save(page).click();

        expect(await newPassword(page).evaluate((input: HTMLInputElement) => input.validity.tooShort)).toBe(true);
        await expect(page).toHaveURL('/members/edituser');
        expect(api.callsTo('PUT core /members/:id/password')).toHaveLength(0);
    });
});
