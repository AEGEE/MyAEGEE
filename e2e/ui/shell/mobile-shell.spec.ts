// The shell on a phone, where the sidebar is closed until asked for: swiping it open and closed,
// the account menu closing on the way to another page, and the switch between a phone's and a
// desktop's width. Opening the menu by its button is in navigation.spec.ts.
import type { Page } from '@playwright/test';

import { ok } from '../support/factories/base.ts';
import { accountMenuToggle, openAccountMenu } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { test, expect } from '../support/test.ts';

// A finger moving across the page from `fromX` to `toX`, half way down.
const swipe = async (page: Page, fromX: number, toX: number): Promise<void> => {
    await page.getByRole('main').evaluate((main, [startX, endX]) => {
        const y = window.innerHeight / 2;
        const touch = (x: number) => new Touch({ identifier: 1, target: main, clientX: x, clientY: y });
        const send = (type: string, x: number, touches: Touch[]) => main.dispatchEvent(new TouchEvent(type, {
            bubbles: true, cancelable: true, touches, changedTouches: [touch(x)]
        }));
        send('touchstart', startX, [touch(startX)]);
        send('touchmove', endX, [touch(endX)]);
        send('touchend', endX, []);
    }, [fromX, toX]);
};

test.describe('the shell on a phone', () => {
    test.beforeEach(async ({ page, api }) => {
        api.json('GET events /', ok([]));
        await page.goto('/events');
        await expect(page.getByText('No events found.')).toBeVisible();
    });

    test('swiping to the right opens the sidebar, and to the left closes it', { tag: '@phone-only' }, async ({ page }) => {
        const toggle = page.getByRole('button', { name: 'Menu', exact: true });
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');

        await swipe(page, 20, 250);
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();

        await swipe(page, 250, 20);
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await expect(page.getByRole('link', { name: 'Dashboard' })).toBeHidden();
    });

    test('the account menu closes on the way to another page', { tag: '@phone-only' }, async ({ page, api, layout }) => {
        api.fallback(mockEverything);
        const account = await openAccountMenu(page, layout);

        await account.getByRole('link', { name: 'See my account' }).click();

        await expect(page).toHaveURL('/members/me');
        await expect(accountMenuToggle(page, layout)).toHaveAttribute('aria-expanded', 'false');
        await expect(account.getByRole('link', { name: 'See my account' })).toBeHidden();
    });

    test('at a desktop\'s width the sidebar opens by itself, and closes again at a phone\'s', { tag: '@phone-only' }, async ({ page }) => {
        await expect(page.getByRole('link', { name: 'Dashboard' })).toBeHidden();

        await page.setViewportSize({ width: 1280, height: 800 });
        await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeHidden();

        await page.setViewportSize({ width: 412, height: 839 });
        await expect(page.getByRole('link', { name: 'Dashboard' })).toBeHidden();
    });

    test('on a desktop the sidebar is open from the start', {
        tag: '@desktop-only',
        annotation: { type: 'desktop-only', description: 'a phone starts with the sidebar closed; the tests above cover that' }
    }, async ({ page }) => {
        await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeHidden();

        // Swiping does nothing at this width.
        await swipe(page, 250, 20);
        await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
        await swipe(page, 20, 250);
        await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    });
});
