// The helpers of ui/support/shell.ts against real pages, on both viewports. These are the
// suite's own checks: when one fails, a helper no longer matches how the app (or Buefy)
// renders, and every spec that uses it is about to fail the same way.
import type { ApiMock } from '../support/api-mock.ts';
import { FIXED_NOW, ok } from '../support/factories/base.ts';
import { application, event, organizerPermissions } from '../support/factories/events.ts';
import { cellOf, dialog, freezeTime, permissionsFor, sortBy, tableRows, toast } from '../support/shell.ts';
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

test.describe('dialogs', () => {
    test('a modal opened from code is a dialog', async ({ page, api }) => {
        showParticipants(api);
        api.json('GET events /single/:id/applications/:application_id', ok({ ...APPLICATIONS[1], notification_email: 'alex@example.com' }));
        await page.goto('/events/spring/participants');

        const table = page.getByRole('table');
        await tableRows(table).filter({ hasText: 'Alex First' }).getByRole('link', { name: 'View' }).click();

        const modal = dialog(page).filter({ hasText: 'View participant' });
        await expect(modal).toBeVisible();
        await expect(modal).toHaveAttribute('aria-modal', 'true');
        await expect(modal.getByText('alex@example.com')).toBeVisible();
        await modal.getByRole('button', { name: 'close' }).click();
        await expect(dialog(page)).toHaveCount(0);
    });

    test('a confirmation opened from code is an alert dialog', async ({ page, api }) => {
        api.json('GET events /single/:id', ok(event({ id: 9, url: 'spring', name: 'Spring Training' }), { permissions: organizerPermissions() }));
        await page.goto('/events/spring');

        await page.getByRole('button', { name: 'Delete event' }).click();

        const confirmation = dialog(page).filter({ hasText: 'Are you sure you want to delete this event?' });
        await expect(confirmation).toBeVisible();
        await expect(confirmation).toHaveAttribute('aria-modal', 'true');
        await confirmation.getByRole('button', { name: 'Cancel' }).click();
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
