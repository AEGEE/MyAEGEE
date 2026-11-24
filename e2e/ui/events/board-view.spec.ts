// Board view of events (/events/boardview): a board sees and comments on the applications made
// from its body.
import type { Page } from '@playwright/test';

import { forbidden, ok, validationError } from '../support/factories/base.ts';
import { body, circle } from '../support/factories/core.ts';
import { boardviewApplication } from '../support/factories/events.ts';
import { cellOf, expectEmptyTable, tableRows, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

// What core answers to POST /my_permissions for approve_members:events: the circles that give it,
// with the bodies they belong to.
const boardOf = (...bodyIds: number[]) => ok(bodyIds.map((bodyId) => [circle({ id: 100 + bodyId, name: `Board ${bodyId}`, body_id: bodyId })]));

const table = (page: Page) => page.getByRole('table');

test.describe('events board view', () => {
    test.use({ session: 'board' });

    test('someone on no board is told so', async ({ page, api }) => {
        api.json('POST core /my_permissions', ok([]));
        await page.goto('/events/boardview');

        await expect(page.getByRole('heading', { name: 'Board view', level: 1 })).toBeVisible();
        await expect(page.getByText('You are not a board member of any body.')).toBeVisible();
        expect(api.callsTo('POST core /my_permissions').map((call) => call.body)).toEqual([{ action: 'approve_members', object: 'events' }]);
    });

    test('a board of one body sees its applications, latest change first', async ({ page, api }) => {
        api.json('POST core /my_permissions', boardOf(1));
        api.json('GET events /boardview/:body_id', ok([
            boardviewApplication({ id: 41, first_name: 'Alex', last_name: 'Member', user_id: 2, status: 'pending', updated_at: '2027-02-01T09:00:00.000Z' }, { id: 5, url: 'spring', name: 'Spring Training' }),
            boardviewApplication({ id: 42, first_name: 'Chris', last_name: 'Other', user_id: 8, status: 'accepted', updated_at: '2027-02-03T09:00:00.000Z', board_comment: 'Very active' }, { id: 6, url: 'nwm', name: 'Network Meeting' }),
            boardviewApplication({ id: 43, first_name: 'Dana', last_name: 'Third', user_id: 9, status: 'rejected', updated_at: '2027-02-02T09:00:00.000Z' }, { id: 7, url: 'conf', name: 'Conference' })
        ]));
        await page.goto('/events/boardview');

        await expect(page.getByText('You are currently viewing applications from AEGEE-Antenna.')).toBeVisible();
        await expect(page.getByText('To allow for an anonymous selection procedure', { exact: false })).toBeVisible();
        const rows = tableRows(table(page));
        await expect(rows).toHaveCount(3);
        const names = async () => Promise.all((await rows.all()).map(async (item) => (await cellOf(table(page), item, 'Name')).innerText()));
        await expect.poll(names).toEqual(['Chris Other', 'Dana Third', 'Alex Member']);

        const chris = rows.filter({ hasText: 'Chris Other' });
        await expect(chris.getByRole('link', { name: 'Network Meeting' })).toHaveAttribute('href', '/events/nwm');
        await expect(chris.getByRole('link', { name: 'Chris Other' })).toHaveAttribute('href', '/members/8');
        await expect(chris.getByRole('textbox', { name: 'Board comment for Chris Other' })).toHaveValue('Very active');
        await expect(await cellOf(table(page), chris, 'Status')).toHaveText('Accepted');
        await expect(await cellOf(table(page), chris, 'Date modified')).toHaveText('2027-02-03 10:00');
        await expect(await cellOf(table(page), rows.filter({ hasText: 'Dana Third' }), 'Status')).toHaveText('Rejected');
        await expect(await cellOf(table(page), rows.filter({ hasText: 'Alex Member' }), 'Status')).toHaveText('Pending');
        expect(api.callsTo('GET events /boardview/:body_id').map((call) => call.params.body_id)).toEqual(['1']);
    });

    test('a board of several bodies chooses which one to see', async ({ page, api, me }) => {
        me!.bodies = [body({ id: 1, name: 'AEGEE-Antenna' }), body({ id: 2, name: 'AEGEE-Second' }), body({ id: 3, name: 'AEGEE-Not-Board' })];
        api.json('POST core /my_permissions', boardOf(1, 2));
        api.on('GET events /boardview/:body_id', ({ params }) => ({
            json: ok([boardviewApplication({ first_name: 'From', last_name: `Body ${params.body_id}` })])
        }));
        await page.goto('/events/boardview');

        await expect(page.getByText('You haven\'t selected the antenna yet.')).toBeVisible();
        const select = page.getByRole('combobox', { name: 'Select the body to view application from:' });
        await expect(select.getByRole('option')).toHaveText(['AEGEE-Antenna', 'AEGEE-Second']);
        expect(api.callsTo('GET events /boardview/:body_id')).toHaveLength(0);

        await select.selectOption({ label: 'AEGEE-Second' });

        await expect(tableRows(table(page)).filter({ hasText: 'From Body 2' })).toBeVisible();
        await expect(page.getByText('You haven\'t selected the antenna yet.')).toHaveCount(0);
        expect(api.callsTo('GET events /boardview/:body_id').map((call) => call.params.body_id)).toEqual(['2']);
    });

    test('saving a board comment', async ({ page, api }) => {
        api.json('POST core /my_permissions', boardOf(1));
        api.json('GET events /boardview/:body_id', ok([boardviewApplication({ id: 41, first_name: 'Alex', last_name: 'Member' }, { id: 5, url: 'spring' })]));
        api.on('PUT events /single/:id/applications/:application_id/comment', ({ body: sent }) => ({ json: ok(boardviewApplication({ id: 41, ...(sent as object) })) }));
        await page.goto('/events/boardview');

        const alex = tableRows(table(page)).filter({ hasText: 'Alex Member' });
        await alex.getByRole('textbox', { name: 'Board comment for Alex Member' }).fill('Active in the local');
        await alex.getByRole('button', { name: 'Save' }).click();

        await expect(toast(page, 'Participant comment is updated.')).toBeVisible();
        expect(api.callsTo('PUT events /single/:id/applications/:application_id/comment').map((call) => [call.params, call.body]))
            .toEqual([[{ id: '5', application_id: '41' }, { board_comment: 'Active in the local' }]]);
    });

    test('a refused comment shows the reason', async ({ page, api }) => {
        api.json('POST core /my_permissions', boardOf(1));
        api.json('GET events /boardview/:body_id', ok([boardviewApplication({ id: 41, first_name: 'Alex', last_name: 'Member' })]));
        api.on('PUT events /single/:id/applications/:application_id/comment', { status: 403, json: forbidden('You are not allowed to put board comments') });
        await page.goto('/events/boardview');

        await tableRows(table(page)).filter({ hasText: 'Alex Member' }).getByRole('button', { name: 'Save' }).click();

        await expect(toast(page, 'Could not update participant comment: You are not allowed to put board comments')).toBeVisible();
    });

    test('a comment the service doesn\'t take shows its message', async ({ page, api }) => {
        api.json('POST core /my_permissions', boardOf(1));
        api.json('GET events /boardview/:body_id', ok([boardviewApplication({ id: 41, first_name: 'Alex', last_name: 'Member' })]));
        api.on('PUT events /single/:id/applications/:application_id/comment', { status: 422, json: { ...validationError({ board_comment: ['board_comment should be a text or null.'] }), message: 'board_comment should be a text or null.' } });
        await page.goto('/events/boardview');

        await tableRows(table(page)).filter({ hasText: 'Alex Member' }).getByRole('button', { name: 'Save' }).click();

        await expect(toast(page, 'Could not update participant comment: board_comment should be a text or null.')).toBeVisible();
    });

    test('failing to load the applications shows the error', async ({ page, api }) => {
        api.json('POST core /my_permissions', boardOf(1));
        api.on('GET events /boardview/:body_id', { status: 403, json: forbidden('You are not allowed to see this') });
        await page.goto('/events/boardview');

        await expect(toast(page, 'Error fetching board view data: You are not allowed to see this')).toBeVisible();
    });

    test('failing to find the member\'s boards shows the error', async ({ page, api }) => {
        api.on('POST core /my_permissions', { abort: 'failed' });
        await page.goto('/events/boardview');

        await expect(toast(page, 'Could not fetch your board bodies: Network Error')).toBeVisible();
        await expect(page.getByText('You are not a board member of any body.')).toHaveCount(0);
    });

    test('a body without applications says there is nothing', async ({ page, api }) => {
        api.json('POST core /my_permissions', boardOf(1));
        api.json('GET events /boardview/:body_id', ok([]));
        await page.goto('/events/boardview');

        await expect.poll(() => api.callsTo('GET events /boardview/:body_id').length).toBe(1);
        await expectEmptyTable(table(page));
    });
});
