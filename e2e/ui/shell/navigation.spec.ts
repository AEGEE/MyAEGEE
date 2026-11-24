// Getting around: the sidebar menu and the account menu, on a desktop and on a phone, where
// both are closed until their button is used.
import { ok } from '../support/factories/base.ts';
import { permission } from '../support/factories/core.ts';
import { openAccountMenu, openMenu } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { test, expect } from '../support/test.ts';

test.describe('navigation', () => {
    test('a member reaches the events list through the menu', async ({ page, api, layout }) => {
        api.json('GET events /', ok([]));
        // A page outside the groups of the menu, so that "Events listing" starts closed.
        await page.goto('/about');
        await expect(page).toHaveTitle('MyAEGEE | About MyAEGEE');

        const menu = await openMenu(page, layout);
        await menu.getByRole('button', { name: 'Events listing' }).click();
        await expect(menu.getByRole('button', { name: 'Events listing' })).toHaveAttribute('aria-expanded', 'true');
        await menu.getByRole('link', { name: 'All events' }).click();

        await expect(page).toHaveURL('/events');
        await expect(page).toHaveTitle('MyAEGEE | List all events');
        await expect(page.getByText('No events found.')).toBeVisible();
    });

    test('a group of the menu opens and closes', async ({ page, layout }) => {
        await page.goto('/about');

        const menu = await openMenu(page, layout);
        const group = menu.getByRole('button', { name: 'Events listing' });
        await expect(group).toHaveAttribute('aria-expanded', 'false');
        await expect(menu.getByRole('link', { name: 'All events' })).toBeHidden();

        await group.click();
        await expect(group).toHaveAttribute('aria-expanded', 'true');
        await expect(menu.getByRole('link', { name: 'All events' })).toHaveAttribute('href', '/events');

        await group.click();
        await expect(menu.getByRole('link', { name: 'All events' })).toBeHidden();
    });

    test('the menu only offers what the member may use', async ({ page, api, layout, myPermissions }) => {
        api.json('GET events /', ok([]));
        await page.goto('/events');

        // Bodies are public; the list of members needs a permission a regular member lacks.
        let menu = await openMenu(page, layout);
        await expect(menu.getByRole('link', { name: 'Bodies' })).toHaveAttribute('href', '/bodies');
        await expect(menu.getByRole('link', { name: 'Members' })).toHaveCount(0);

        myPermissions.push(permission('global:view:member'));
        await page.reload();
        await expect(page.getByText('No events found.')).toBeVisible();
        menu = await openMenu(page, layout);
        await expect(menu.getByRole('link', { name: 'Members' })).toHaveAttribute('href', '/members');
    });

    test('the logo leads to the start page', async ({ page, api, layout }) => {
        api.json('GET events /', ok([]));
        await page.goto('/events');

        const account = await openAccountMenu(page, layout);
        await expect(account.getByRole('link', { name: 'MyAEGEE home' })).toHaveAttribute('href', '/');
    });

    test('on a phone the menu is closed until asked for, and closes after choosing a page', { tag: '@phone-only' }, async ({ page, api, layout }) => {
        api.json('GET events /', ok([]));
        // The page the menu leads to belongs to another area: any answer will do for it.
        api.fallback(mockEverything);
        await page.goto('/events');
        await expect(page.getByText('No events found.')).toBeVisible();

        const toggle = page.getByRole('button', { name: 'Menu', exact: true });
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await expect(page.getByRole('link', { name: 'Bodies' })).toBeHidden();

        const menu = await openMenu(page, layout);
        await menu.getByRole('link', { name: 'Bodies' }).click();

        await expect(page).toHaveURL('/bodies');
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await expect(page.getByRole('link', { name: 'Bodies' })).toBeHidden();
    });

    test('on a phone the account menu puts the main menu out of reach', { tag: '@phone-only' }, async ({ page, api, layout }) => {
        api.json('GET events /', ok([]));
        await page.goto('/events');

        const menu = await openMenu(page, layout);
        await expect(menu.getByRole('link', { name: 'Dashboard' })).toBeVisible();

        const account = await openAccountMenu(page, layout);
        await expect(account.getByRole('link', { name: 'See my account' })).toBeVisible();
        // The main menu slides off the screen: its links must not stay behind for the keyboard.
        await expect(menu.getByRole('link', { name: 'Dashboard' })).toBeHidden();
    });
});
