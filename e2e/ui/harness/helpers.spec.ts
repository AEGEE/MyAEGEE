// The helpers of ui/support/shell.ts against real pages, on both viewports. These are the
// suite's own checks: when one fails, a helper no longer matches how the app (or Buefy)
// renders, and every spec that uses it is about to fail the same way.
import type { ApiMock } from '../support/api-mock.ts';
import { FIXED_NOW, ok } from '../support/factories/base.ts';
import { application, event, organizerPermissions } from '../support/factories/events.ts';
import { cellOf, dialog, expectEmptyTable, freezeTime, permissionsFor, sortBy, tableRows, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const APPLICATIONS = [
    application({ id: 31, user_id: 7, first_name: 'Carla', last_name: 'Third', body_name: 'AEGEE-Zulu', body_id: 3, status: 'accepted' }),
    application({ id: 32, user_id: 5, first_name: 'Alex', last_name: 'First', body_name: 'AEGEE-Antenna', body_id: 1 }),
    application({ id: 33, user_id: 6, first_name: 'Bea', last_name: 'Second', body_name: 'AEGEE-Yankee', body_id: 2, status: 'rejected' })
];

const showParticipants = (api: ApiMock): void => {
    api.json('GET events /single/:id', ok(event({ id: 9, url: 'spring', name: 'Spring Training' }), { permissions: organizerPermissions() }));
    api.json('GET events /single/:id/applications', ok(APPLICATIONS));
};

test.describe('tables', () => {
    test.beforeEach(({ api }) => showParticipants(api));

    test('rows are found by their text, and cells by the header of their column', async ({ page }) => {
        await page.goto('/events/spring/participants');

        const table = page.getByRole('table');
        await expect(tableRows(table)).toHaveCount(3);
        const row = tableRows(table).filter({ hasText: 'Bea Second' });
        await expect(await cellOf(table, row, 'User ID')).toHaveText('6');
        await expect(await cellOf(table, row, 'First and last name')).toHaveText('Bea Second');
        await expect((await cellOf(table, row, 'Body')).getByRole('link', { name: 'AEGEE-Yankee' })).toHaveAttribute('href', '/bodies/2');
        await expect((await cellOf(table, row, /^Manage status/)).getByRole('combobox')).toHaveValue('rejected');
    });

    test('a table sorts by a column, in both directions', async ({ page, layout }) => {
        await page.goto('/events/spring/participants');
        const table = page.getByRole('table');
        const names = async () => Promise.all((await tableRows(table).all()).map(async (row) => (await cellOf(table, row, 'First and last name')).innerText()));
        await expect.poll(names).toEqual(['Carla Third', 'Alex First', 'Bea Second']);

        await sortBy(table, 'User ID', layout);
        await expect.poll(names).toEqual(['Alex First', 'Bea Second', 'Carla Third']);

        await sortBy(table, 'First and last name', layout, 'desc');
        await expect.poll(names).toEqual(['Carla Third', 'Bea Second', 'Alex First']);
    });

    test('a control in a row is used the same way on both viewports', async ({ page, api }) => {
        api.json('PUT events /single/:id/applications/:application_id/status', ok({}));
        await page.goto('/events/spring/participants');

        const table = page.getByRole('table');
        const row = tableRows(table).filter({ hasText: 'Alex First' });
        await (await cellOf(table, row, 'Manage status')).getByRole('combobox').selectOption('Accepted');

        await expect(toast(page, 'Successfully updated status of application for user #5 to "accepted"')).toBeVisible();
        expect(api.callsTo('PUT events /single/:id/applications/:application_id/status').map((call) => [call.params, call.body]))
            .toEqual([[{ id: 'spring', application_id: '32' }, { status: 'accepted' }]]);
    });
});

test.describe('empty tables', () => {
    test('a table without data has no rows, although Buefy renders a row to say so', async ({ page, api }) => {
        api.json('GET events /mine/approvable', ok([]));
        await page.goto('/events/change_status');

        const table = page.getByRole('table');
        await expectEmptyTable(table);
        await expect(table.getByText('Nothing here.')).toBeVisible();
        // The row that says so is a row with a cell for the browser, and not one of tableRows().
        await expect(table.getByRole('row').filter({ has: page.getByRole('cell') })).toHaveCount(1);
        await expect(tableRows(table)).toHaveCount(0);
    });

    test('a table without a text for the empty state is empty too', async ({ page, api }) => {
        api.json('GET events /single/:id', ok(event({ id: 9, url: 'spring', name: 'Spring Training' }), { permissions: organizerPermissions() }));
        api.json('GET events /single/:id/applications', ok([]));
        await page.goto('/events/spring/participants');
        await expect(page.getByText('Total applications: 0.')).toBeVisible();

        await expectEmptyTable(page.getByRole('table'), null);
    });
});

test.describe('dialogs', () => {
    test('a modal opened from code is a dialog', async ({ page, api }) => {
        showParticipants(api);
        api.json('GET events /single/:id/applications/:application_id', ok({ ...APPLICATIONS[1], notification_email: 'alex@example.com' }));
        await page.goto('/events/spring/participants');

        const table = page.getByRole('table');
        await tableRows(table).filter({ hasText: 'Alex First' }).getByRole('button', { name: /^View/ }).click();

        const modal = dialog(page).filter({ hasText: 'View participant' });
        await expect(modal).toBeVisible();
        await expect(modal).toHaveAttribute('aria-modal', 'true');
        await expect(modal.getByText('alex@example.com')).toBeVisible();
        await modal.getByRole('button', { name: 'close' }).click();
        await expect(dialog(page)).toHaveCount(0);
    });

    test('a confirmation opened from code is an alert dialog, named by its title and described by its message', async ({ page, api }) => {
        api.json('GET events /single/:id', ok(event({ id: 9, url: 'spring', name: 'Spring Training' }), { permissions: organizerPermissions() }));
        await page.goto('/events/spring');

        await page.getByRole('button', { name: 'Delete event' }).click();

        // Found by its role and its name, with nothing else to tell it apart.
        const confirmation = page.getByRole('alertdialog', { name: 'Deleting an event', exact: true });
        await expect(confirmation).toBeVisible();
        await expect(confirmation).toHaveAttribute('aria-modal', 'true');
        await expect(confirmation).toHaveAccessibleDescription('Are you sure you want to delete this event?');
        // The helper finds the same dialog by that name.
        await expect(dialog(page, 'Deleting an event')).toHaveCount(1);
        await expect(dialog(page, 'Another dialog')).toHaveCount(0);

        await confirmation.getByRole('button', { name: 'Cancel' }).click();
        await expect(dialog(page)).toHaveCount(0);
    });

    test('every dialog gets its own name, also the second one of a page', async ({ page, api }) => {
        api.json('GET events /single/:id', ok(event({ id: 9, url: 'spring', name: 'Spring Training', status: 'draft', budget: 'x', programme: 'x' }), { permissions: organizerPermissions() }));
        await page.goto('/events/spring');

        await page.getByRole('button', { name: 'Delete event' }).click();
        await dialog(page, 'Deleting an event').getByRole('button', { name: 'Cancel' }).click();
        await expect(dialog(page)).toHaveCount(0);

        await page.getByRole('button', { name: 'Ask for approval' }).click();
        const second = page.getByRole('alertdialog', { name: 'Change status', exact: true });
        await expect(second).toBeVisible();
        await expect(second).toHaveAccessibleDescription(/Are you sure you want to/);
        await second.getByRole('button', { name: 'Cancel' }).click();
        await expect(dialog(page)).toHaveCount(0);
    });
});

test.describe('time and permissions', () => {
    test('a frozen clock is what the page calls now, and it keeps running', async ({ page, api }) => {
        await freezeTime(page);
        api.json('GET events /', ok([]));

        await page.goto('/events');
        await expect(page.getByText('No events found.')).toBeVisible();

        // The list asks for events that start from today on.
        expect(api.callsTo('GET events /')[0].query.get('starts')).toBe('2027-03-01');
        const before = await page.evaluate(() => Date.now());
        expect(before).toBeGreaterThanOrEqual(Date.parse(FIXED_NOW));
        expect(before).toBeLessThan(Date.parse(FIXED_NOW) + 60_000);
        await expect.poll(() => page.evaluate(() => Date.now())).toBeGreaterThan(before);
    });

    test('permissionsFor answers what a member may do with one body', async ({ page, api }) => {
        permissionsFor(api, 'bodies', 1, ['local:update:body', 'local:view_members:body']);

        await page.goto('/about');
        const answer = await page.evaluate(async () => (await fetch('/api/core/bodies/1/my_permissions')).json());

        expect(answer.success).toBe(true);
        expect(answer.data.map((item: { combined: string }) => item.combined)).toEqual(['local:update:body', 'local:view_members:body']);
        expect(answer.data[0]).toMatchObject({ scope: 'local', action: 'update', object: 'body' });
    });
});
