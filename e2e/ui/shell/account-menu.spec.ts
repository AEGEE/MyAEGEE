// The account menu of the top bar: opened by its button (the member's name on a desktop, the
// "Account menu" button on a phone), and closed again by Escape, by a click elsewhere and by
// focus moving on.
import { ok } from '../support/factories/base.ts';
import { accountMenuToggle, openAccountMenu } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

test.describe('account menu', () => {
    test.beforeEach(async ({ page, api }) => {
        api.json('GET events /', ok([]));
        await page.goto('/events');
        await expect(page.getByText('No events found.')).toBeVisible();
    });

    test('Escape closes it and gives the focus back to its button', async ({ page, layout }) => {
        const account = await openAccountMenu(page, layout);
        const toggle = accountMenuToggle(page, layout);
        await expect(account.getByRole('link', { name: 'See my account' })).toBeVisible();
        await account.getByRole('link', { name: 'See my account' }).focus();

        await page.keyboard.press('Escape');

        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await expect(account.getByRole('link', { name: 'See my account' })).toBeHidden();
        await expect(toggle).toBeFocused();
    });

    test('a click outside the menu closes it', async ({ page, layout }) => {
        const account = await openAccountMenu(page, layout);
        const toggle = accountMenuToggle(page, layout);
        await expect(account.getByRole('button', { name: 'Logout' })).toBeVisible();

        await page.getByText('No events found.').click();

        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await expect(account.getByRole('button', { name: 'Logout' })).toBeHidden();
    });

    test('it closes when the focus moves on past its last entry', async ({ page, layout }) => {
        const account = await openAccountMenu(page, layout);
        const toggle = accountMenuToggle(page, layout);
        await account.getByRole('link', { name: 'See my account' }).focus();

        // Within the menu it stays open.
        await page.keyboard.press('Tab');
        await expect(account.getByRole('button', { name: 'Logout' })).toBeFocused();
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');

        await page.keyboard.press('Tab');
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await expect(account.getByRole('button', { name: 'Logout' })).toBeHidden();
    });

    test('its button opens and closes it', async ({ page, layout }) => {
        const account = await openAccountMenu(page, layout);
        const toggle = accountMenuToggle(page, layout);
        await expect(account.getByRole('link', { name: 'See my account' })).toBeVisible();

        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await expect(account.getByRole('link', { name: 'See my account' })).toBeHidden();

        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await expect(account.getByRole('link', { name: 'See my account' })).toBeVisible();
    });

    test('Logout is highlighted like the link above it when it has the focus', async ({ page, layout }) => {
        const account = await openAccountMenu(page, layout);
        const link = account.getByRole('link', { name: 'See my account' });
        const logout = account.getByRole('button', { name: 'Logout' });
        const colours = (element: Element): string[] => [getComputedStyle(element).backgroundColor, getComputedStyle(element).color];
        const [plain] = await logout.evaluate(colours);

        await link.focus();
        const [background, text] = await link.evaluate(colours);
        expect(background).not.toBe(plain);

        await logout.focus();
        await expect(logout).toHaveCSS('background-color', background);
        await expect(logout).toHaveCSS('color', text);
    });

    test('on a desktop the pointer opens it, and Escape closes it under the pointer', {
        tag: '@desktop-only',
        annotation: { type: 'desktop-only', description: 'a phone has no pointer to hover with; its menu is opened by the button (the tests above)' }
    }, async ({ page, layout }) => {
        const toggle = accountMenuToggle(page, layout);
        const account = page.getByRole('navigation', { name: 'Account' });
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');

        await toggle.hover();
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await expect(account.getByRole('link', { name: 'See my account' })).toBeVisible();

        await page.keyboard.press('Escape');
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await expect(account.getByRole('link', { name: 'See my account' })).toBeHidden();

        // Opened by the pointer again, it goes when the pointer leaves…
        await page.getByText('No events found.').hover();
        await toggle.hover();
        await expect(account.getByRole('link', { name: 'See my account' })).toBeVisible();
        await page.getByText('No events found.').hover();
        await expect(account.getByRole('link', { name: 'See my account' })).toBeHidden();

        // …unless a click has kept it open.
        await toggle.click();
        await page.getByText('No events found.').hover();
        await expect(account.getByRole('link', { name: 'See my account' })).toBeVisible();

        // A second click closes it, also under the pointer.
        await toggle.click();
        await expect(account.getByRole('link', { name: 'See my account' })).toBeHidden();
        // A double-click is one decision, not two: it doesn't open the menu and close it again.
        await page.getByText('No events found.').hover();
        await toggle.dblclick();
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await expect(account.getByRole('link', { name: 'See my account' })).toBeVisible();
    });
});
