// Background tasks of the statutory service (/statutory/tasks): the jobs it has scheduled, such
// as opening and closing the applications of a position.
import { forbidden, ok } from '../support/factories/base.ts';
import { statutoryTask, statutoryTasks } from '../support/factories/statutory-events.ts';
import { cellOf, expectEmptyTable, tableRows, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

test.describe('statutory background tasks', () => {
    test('lists the scheduled tasks with what they do and when', async ({ page, api }) => {
        api.json('GET statutory /tasks', ok(statutoryTasks(
            // 09:00 UTC is 10:00 in Brussels in winter, 11:00 in summer.
            statutoryTask({ id: 1, key: 'OPEN_POSITION_APPLICATIONS', params: { id: 5 }, time: '2027-03-01T09:00:00.000Z' }),
            statutoryTask({ id: 2, key: 'CLOSE_ATTENDANCES', params: { id: 2 }, time: '2027-07-01T09:00:30.000Z' })
        )));

        await page.goto('/statutory/tasks');

        await expect(page.getByRole('heading', { name: 'Statutory background tasks' })).toBeVisible();
        await expect(page).toHaveTitle('MyAEGEE | See background tasks for statutory');
        const table = page.getByRole('table');
        await expect(tableRows(table)).toHaveCount(2);
        const opening = tableRows(table).filter({ hasText: 'OPEN_POSITION_APPLICATIONS' });
        await expect(await cellOf(table, opening, 'ID')).toHaveText('1');
        await expect(await cellOf(table, opening, 'Key')).toHaveText('OPEN_POSITION_APPLICATIONS');
        await expect(await cellOf(table, opening, 'Description')).toHaveText('Open position application deadline');
        await expect(await cellOf(table, opening, 'Params')).toHaveText('{"id":5}');
        await expect(await cellOf(table, opening, 'Time')).toHaveText('2027-03-01 10:00:00');

        const closing = tableRows(table).filter({ hasText: 'CLOSE_ATTENDANCES' });
        await expect(await cellOf(table, closing, 'Description')).toHaveText('Closing plenary attendance');
        await expect(await cellOf(table, closing, 'Time')).toHaveText('2027-07-01 11:00:30');
    });

    test('says so when nothing is scheduled', async ({ page, api }) => {
        api.json('GET statutory /tasks', ok({}));

        await page.goto('/statutory/tasks');

        await expectEmptyTable(page.getByRole('table'));
    });

    test('a member without the permission is told so', async ({ page, api }) => {
        api.on('GET statutory /tasks', { status: 403, json: forbidden('You cannot see background tasks.') });

        await page.goto('/statutory/tasks');

        await expect(toast(page, 'Some error happened: You cannot see background tasks.')).toBeVisible();
        await expectEmptyTable(page.getByRole('table'));
    });
});
