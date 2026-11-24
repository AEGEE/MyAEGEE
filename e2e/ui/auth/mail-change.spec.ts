// The page that confirms a change of a member's login email (/mail-change), opened from the
// link in the mail to the new address, or to the current one when somebody else asked for the
// change.
import { notFound, validationError } from '../support/factories/base.ts';
import { toast } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { test, expect } from '../support/test.ts';

const CHANGED = { success: true, message: 'Mail was changed successfully.', data: { changed: true } };

test.describe('confirming a change of the login email', () => {
    test.beforeEach(({ api }) => {
        // The profile the page goes on to is a page of another area.
        api.fallback(mockEverything);
    });

    test('the link fills in the token; confirming ends on the member\'s profile', async ({ page, api }) => {
        api.json('POST core /confirm-email-change', CHANGED);
        await page.goto('/mail-change?token=change-token');

        await expect(page.getByLabel('Token')).toHaveValue('change-token');
        await expect(page).toHaveTitle('MyAEGEE | Change your email');
        expect(api.callsTo('POST core /confirm-email-change')).toEqual([]);

        await page.getByRole('button', { name: 'Confirm email change' }).click();

        await expect(toast(page, 'Mail was changed successfully.')).toBeVisible();
        await expect(page).toHaveURL('/members/me');
        expect(api.callsTo('POST core /confirm-email-change').map((call) => call.body)).toEqual([{ token: 'change-token' }]);
    });

    test('a change that waits for the other address says so and stays on the page', async ({ page, api }) => {
        const message = 'Confirmed. The email changes after the new address confirms it too.';
        api.json('POST core /confirm-email-change', { success: true, message, data: { changed: false, waiting_for: 'new_email' } });
        await page.goto('/mail-change?token=old-address-token');

        await page.getByRole('button', { name: 'Confirm email change' }).click();

        await expect(page.getByRole('status').filter({ hasText: message })).toBeVisible();
        await expect(page).toHaveURL('/mail-change?token=old-address-token');
        await expect(toast(page, 'Mail was changed successfully.')).toHaveCount(0);
    });

    test('an unknown or expired token is called invalid or expired', async ({ page, api }) => {
        api.on('POST core /confirm-email-change', { status: 404, json: notFound('Token is expired.') });
        await page.goto('/mail-change?token=old');

        await page.getByRole('button', { name: 'Confirm email change' }).click();

        await expect(toast(page, 'The token is invalid or expired.')).toBeVisible();
    });

    test('an address that another account took in the meantime is named', async ({ page, api }) => {
        api.on('POST core /confirm-email-change', { status: 422, json: validationError({ email: ['User with this email already exists.'] }) });
        await page.goto('/mail-change?token=change-token');

        await page.getByRole('button', { name: 'Confirm email change' }).click();

        await expect(toast(page, 'Could not change email: User with this email already exists.')).toBeVisible();
    });

    test('another error shows core\'s message', async ({ page, api }) => {
        api.on('POST core /confirm-email-change', { status: 500, json: { success: false, message: 'Could not send the mail.' } });
        await page.goto('/mail-change?token=change-token');

        await page.getByRole('button', { name: 'Confirm email change' }).click();

        await expect(toast(page, 'Could not change email: Could not send the mail.')).toBeVisible();
    });

    test.describe('anonymously', () => {
        test.use({ session: 'anonymous' });

        test('confirming while logged out ends on the login page, on the way to the profile', async ({ page, api }) => {
            api.json('POST core /confirm-email-change', CHANGED);
            await page.goto('/mail-change?token=change-token');

            await page.getByRole('button', { name: 'Confirm email change' }).click();

            await expect(toast(page, 'Mail was changed successfully.')).toBeVisible();
            await expect(page).toHaveURL((url) => url.pathname === '/login' && url.searchParams.get('to') === '/members/me');
            await expect(toast(page, /Could not change email/)).toHaveCount(0);
        });
    });
});
