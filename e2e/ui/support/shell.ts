// Helpers for the parts of the app every page shares: toasts, dialogs, the two menus, tables,
// permissions, the clock and date pickers.
//
// Every helper works on both viewports. Where the steps differ on a phone (the menus are
// closed, tables are shown as cards), the difference is in here, so a spec reads the same
// for both. See docs/testing/writing-ui-specs.md.
import { expect, type BrowserContext, type Locator, type Page } from '@playwright/test';

import type { ApiMock } from './api-mock.ts';
import { FIXED_NOW, ok } from './factories/base.ts';
import { permission } from './factories/core.ts';
import type { Layout } from './test.ts';

// The toast the app shows after an action. A toast stays for three seconds, longer for a long
// text (up to ten): assert it right after the action.
export const toast = (page: Page, text: string | RegExp): Locator => page.getByRole('alert').or(page.getByRole('status')).filter({ hasText: text });

// The open confirmation, prompt or modal, by its name where one is given: the `title` of a
// dialog (`$buefy.dialog.confirm`/`alert`/`prompt`; one without a title is named by its
// message) or the `ariaLabel` of a modal. `dialog(page, 'Deleting an event')`; or filter by
// text: `dialog(page).filter({ hasText: 'Are you sure' })`.
export const dialog = (page: Page, name?: string | RegExp): Locator => page.getByRole('alertdialog', { name }).or(page.getByRole('dialog', { name }));

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

// The button that opens and closes the account menu: the member's name on a desktop, the
// "Account menu" button on a phone. Its `aria-expanded` says whether the menu is open.
export const accountMenuToggle = (page: Page, layout: Layout): Locator => {
    const bar = page.getByRole('navigation', { name: 'Account' });
    if (layout === 'phone') return bar.getByRole('button', { name: 'Account menu', exact: true });
    // The first button of the top bar on a desktop is the member's name (the buttons for a
    // phone are not shown).
    return bar.getByRole('button').first();
};

// The account menu in the top bar: "See my account" and "Logout" for a member, "Login" for a
// visitor. On a phone it is behind the "Account menu" button; on a desktop the member's name
// opens it.
export const openAccountMenu = async (page: Page, layout: Layout): Promise<Locator> => {
    const bar = page.getByRole('navigation', { name: 'Account' });
    const toggle = accountMenuToggle(page, layout);
    await routeIsShown(page);
    if (layout === 'phone') {
        await open(toggle);
        return bar;
    }

    // A visitor has a link to log in instead of a menu.
    await expect(toggle.or(bar.getByRole('link', { name: 'Login', exact: true }))).toBeVisible();
    if (await toggle.isVisible()) await open(toggle);
    return bar;
};

// Buefy's row for a table without data: one cell over all columns, with what the page puts in
// the table's `empty` slot ("Nothing here.").
// eslint-disable-next-line no-restricted-syntax -- that row is a row with a cell like any other; only Buefy's class tells it apart
const emptyRow = (table: Locator): Locator => table.locator('tr.is-empty');

// The rows of a table that hold data: not the header row, and not the row Buefy shows when
// there is no data, so an empty table has 0 rows (check that with `expectEmptyTable()`). On a
// phone Buefy shows a table as cards, but the rows and cells keep their roles; only the column
// headers are hidden, and the names of rows and cells gain the column labels. So find a row by
// its text (`tableRows(table).filter({ hasText: 'Alex Member' })`), not by an exact name.
export const tableRows = (table: Locator): Locator => table.getByRole('row')
    .filter({ has: table.page().getByRole('cell') })
    // eslint-disable-next-line no-restricted-syntax -- see emptyRow()
    .and(table.locator('tr:not(.is-empty)'));

// The table has no data and says so: no data rows, and the row for the empty state is shown,
// with `text` in it where the page gives one (the app's own is "Nothing here."; pass null for
// a table without an `empty` slot). Wait for the table's request first, or check what the page
// shows once it has the answer: a table that is still loading is empty too.
export const expectEmptyTable = async (table: Locator, text: string | RegExp | null = 'Nothing here.'): Promise<void> => {
    await expect(emptyRow(table)).toBeVisible();
    if (text !== null) await expect(emptyRow(table)).toContainText(text);
    await expect(tableRows(table)).toHaveCount(0);
};

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
// tableRows(table). The position of the column is read once the row is shown and has a cell
// under every header: a page that adds columns when its data arrives, or after its rows, has
// its final columns by then.
export const cellOf = async (table: Locator, row: Locator, column: string | RegExp): Promise<Locator> => {
    await expect(row.first()).toBeVisible();
    // eslint-disable-next-line no-restricted-syntax -- the helpers are where column headers are looked up
    const headers = table.getByRole('columnheader', { includeHidden: true });
    await expect(async () => {
        expect(await row.first().getByRole('cell').count(), 'a cell under every column header').toBe(await headers.count());
    }).toPass({ timeout: 5000 });
    return row.getByRole('cell').nth(await columnIndex(table, column));
};

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

// Sets "now" for the page (and every other page of the test), before the first page.goto().
// The clock keeps running from that instant, so toasts and timers behave as usual. Build dates
// for such a spec with `iso(n, Date.parse(FIXED_NOW))`.
export const freezeTime = async (page: Page | BrowserContext, iso: string = FIXED_NOW): Promise<void> => {
    // eslint-disable-next-line no-restricted-syntax -- the one place that sets the clock
    await page.clock.install({ time: new Date(iso) });
};

// Lets `ms` milliseconds pass for the page at once, after `freezeTime(page)`: to see what is
// left after a toast's time is up, or a timer of the page fire, without waiting for it.
export const passTime = async (page: Page, ms: number): Promise<void> => {
    // eslint-disable-next-line no-restricted-syntax -- the clock is only touched in these helpers
    await page.clock.fastForward(ms);
};

// Types a date into a date picker (flatpickr), in the format the picker shows:
// `fillDate(page.getByLabel('Starts'), '2027-03-01 10:00')`. The picker needs `allowInput` and
// `disableMobile` in its config; without the second one a phone gets the browser's own date
// input instead, which takes another format.
export const fillDate = async (input: Locator, value: string): Promise<void> => {
    await input.fill(value);
    await input.press('Enter');
};
