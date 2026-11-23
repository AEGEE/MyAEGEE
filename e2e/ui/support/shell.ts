// Helpers for the parts of the app every page shares: toasts, dialogs, the two menus, tables,
// permissions, the clock and date pickers.
//
// Every helper works on both viewports. Where the steps differ on a phone (the menus are
// closed, tables are shown as cards), the difference is in here, so a spec reads the same
// for both. See docs/testing/writing-ui-specs.md.
import { expect, type Locator, type Page } from '@playwright/test';

import type { ApiMock } from './api-mock.ts';
import { FIXED_NOW, ok } from './factories/base.ts';
import { permission } from './factories/core.ts';
import type { Layout } from './test.ts';

// The toast the app shows after an action. Toasts are gone after three seconds: assert them
// right after the action.
export const toast = (page: Page, text: string | RegExp): Locator => page.getByRole('alert').or(page.getByRole('status')).filter({ hasText: text });

// The open confirmation, prompt or modal. Filter by text when there could be more than one:
// `dialog(page).filter({ hasText: 'Delete event' })`.
export const dialog = (page: Page): Locator => page.getByRole('alertdialog').or(page.getByRole('dialog'));

// The first navigation is finished: the bar above the page shows the label of the route.
// Until then the app is still fetching who is logged in, and on a phone it closes both menus
// again once it knows.
const routeIsShown = async (page: Page): Promise<void> => {
    await expect(page.getByRole('main').getByRole('heading').first()).toHaveText(/\S/);
};

const open = async (toggle: Locator): Promise<void> => {
    if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
};

// The sidebar menu. On a phone it is closed when a page loads and closes again on every
// navigation, so call this every time before using a menu link, never keep the result over a
// navigation, and wait for the new page before calling it again.
export const openMenu = async (page: Page, layout: Layout): Promise<Locator> => {
    // eslint-disable-next-line no-restricted-syntax -- the one place that knows where the main menu is
    const menu = page.getByRole('navigation', { name: 'Main menu' });
    await routeIsShown(page);
    if (layout === 'phone') await open(page.getByRole('button', { name: 'Menu', exact: true }));
    await expect(menu).toBeVisible();
    return menu;
};

// The account menu in the top bar: "See my account" and "Logout" for a member, "Login" for a
// visitor. On a phone it is behind the "Account menu" button; on a desktop the member's name
// opens it.
export const openAccountMenu = async (page: Page, layout: Layout): Promise<Locator> => {
    const bar = page.getByRole('navigation', { name: 'Account' });
    await routeIsShown(page);
    if (layout === 'phone') {
        await open(bar.getByRole('button', { name: 'Account menu', exact: true }));
        return bar;
    }

    // The first button of the top bar on a desktop is the member's name (the buttons for a
    // phone are not shown); a visitor has a link to log in instead.
    const name = bar.getByRole('button').first();
    await expect(name.or(bar.getByRole('link', { name: 'Login', exact: true }))).toBeVisible();
    if (await name.isVisible()) await open(name);
    return bar;
};

// The rows of a table that hold data (not the header row). On a phone Buefy shows a table as
// cards, but the rows and cells keep their roles; only the column headers are hidden, and the
// names of rows and cells gain the column labels. So find a row by its text
// (`tableRows(table).filter({ hasText: 'Alex Member' })`), not by an exact name.
export const tableRows = (table: Locator): Locator => table.getByRole('row').filter({ has: table.page().getByRole('cell') });

const columnIndex = async (table: Locator, column: string | RegExp): Promise<number> => {
    // The headers are in the page on a phone too, only not shown.
    // eslint-disable-next-line no-restricted-syntax -- the helpers are where column headers are looked up
    const headers = table.getByRole('columnheader', { includeHidden: true });
    let labels: string[] = [];
    await expect(async () => {
        labels = (await headers.allTextContents()).map((text) => text.trim().replace(/\s+/g, ' '));
        expect(labels.some((label) => (typeof column === 'string' ? label === column : column.test(label))), `a column "${column}" among: ${labels.join(', ')}`).toBe(true);
    }).toPass({ timeout: 5000 });
    return labels.findIndex((label) => (typeof column === 'string' ? label === column : column.test(label)));
};

// The cell of `row` in the column with this header, on both viewports. `row` is one of
// tableRows(table).
export const cellOf = async (table: Locator, row: Locator, column: string | RegExp): Promise<Locator> => row.getByRole('cell').nth(await columnIndex(table, column));

// Sorts a table by a column: a click on the column header on a desktop, Buefy's sort control
// above the cards on a phone. Starts from a table that isn't sorted by that column yet.
export const sortBy = async (table: Locator, column: string, layout: Layout, direction: 'asc' | 'desc' = 'asc'): Promise<void> => {
    if (layout === 'desktop') {
        // eslint-disable-next-line no-restricted-syntax -- the helpers are where column headers are looked up
        const header = table.getByRole('columnheader').nth(await columnIndex(table, column));
        await header.click();
        if (direction === 'desc') await header.click();
        return;
    }

    // eslint-disable-next-line no-restricted-syntax -- Buefy's mobile sort control has no name, and it is next to the table, not in it
    const control = table.locator('xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " b-table ")][1]').locator('.table-mobile-sort');
    await control.getByRole('combobox').selectOption({ label: column });
    if (direction === 'desc') await control.getByRole('button').click();
};

// What core answers when a page asks what the member may do with one body, member or circle:
// `permissionsFor(api, 'bodies', 1, ['local:update:body'])`.
export const permissionsFor = (api: ApiMock, kind: 'bodies' | 'members' | 'circles', id: number | string, combined: string[]): void => {
    api.json(`GET core /${kind}/${id}/my_permissions`, ok(combined.map(permission)));
};

// Sets "now" for the page, before the first page.goto(). The clock keeps running from that
// instant, so toasts and timers behave as usual. Build dates for such a spec with
// `iso(n, Date.parse(FIXED_NOW))`.
export const freezeTime = async (page: Page, iso: string = FIXED_NOW): Promise<void> => {
    // eslint-disable-next-line no-restricted-syntax -- the one place that sets the clock
    await page.clock.install({ time: new Date(iso) });
};

// Types a date into a date picker (flatpickr), in the format the picker shows:
// `fillDate(page.getByLabel('Starts'), '2027-03-01 10:00')`. The picker needs `allowInput` and
// `disableMobile` in its config; without the second one a phone gets the browser's own date
// input instead, which takes another format.
export const fillDate = async (input: Locator, value: string): Promise<void> => {
    await input.fill(value);
    await input.press('Enter');
};
