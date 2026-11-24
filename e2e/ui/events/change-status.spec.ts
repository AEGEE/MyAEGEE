// Changing events' statuses (/events/change_status): the approval team's list of events to
// approve.
import type { Page } from '@playwright/test';

import { forbidden, ok } from '../support/factories/base.ts';
import { organizedEvent } from '../support/factories/events.ts';
import { cellOf, expectEmptyTable, tableRows, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const STATUS_CHANGED = { success: true, message: 'Successfully changed approval status' };

const table = (page: Page) => page.getByRole('table');
const row = (page: Page, name: string) => tableRows(table(page)).filter({ hasText: name });

test.describe('changing events\' statuses', () => {
    test.use({ session: 'superadmin' });

    test('lists the events to approve with a button for each status', async ({ page, api }) => {
        api.json('GET events /mine/approvable', ok([
            organizedEvent({ id: 1, url: 'draft-one', name: 'Draft One', status: 'draft', type: 'training', description: 'Learn **things**.', starts: '2027-05-01T07:00:00.000Z', ends: '2027-05-05T15:00:00.000Z' }),
            organizedEvent({ id: 2, url: '', name: 'Submitted Two', status: 'submitted', type: 'nwm' })
        ]));
        await page.goto('/events/change_status');

        await expect(page.getByRole('heading', { name: 'Change events\' statuses' })).toBeVisible();
        const draft = row(page, 'Draft One');
        await expect(draft).toBeVisible();
        await expect(await cellOf(table(page), draft, 'Event type')).toHaveText('Training Event');
        await expect(draft.getByRole('link', { name: 'Draft One' })).toHaveAttribute('href', '/events/draft-one');
        await expect((await cellOf(table(page), draft, 'Description')).getByText('things')).toHaveJSProperty('tagName', 'STRONG');
        await expect(await cellOf(table(page), draft, 'Event dates')).toHaveText('2027-05-01 - 2027-05-05');
        await expect(await cellOf(table(page), draft, 'Current status')).toHaveText('Draft');
        await expect(draft.getByRole('button')).toHaveText(['Request approval']);

        const submitted = row(page, 'Submitted Two');
        // Without a URL the link uses the id.
        await expect(submitted.getByRole('link', { name: 'Submitted Two' })).toHaveAttribute('href', '/events/2');
        await expect(await cellOf(table(page), submitted, 'Current status')).toHaveText('Submitted');
        await expect(submitted.getByRole('button')).toHaveText(['Publish', 'Request changes']);
    });

    test('publishing a submitted event, which can then be unpublished', async ({ page, api }) => {
        api.json('GET events /mine/approvable', ok([organizedEvent({ id: 2, name: 'Submitted Two', status: 'submitted' })]));
        api.json('PUT events /single/:id/status', STATUS_CHANGED);
        await page.goto('/events/change_status');
        const submitted = row(page, 'Submitted Two');

        await submitted.getByRole('button', { name: 'Publish' }).click();
        await expect(toast(page, 'Event status is now "published".')).toBeVisible();
        await expect(await cellOf(table(page), submitted, 'Current status')).toHaveText('Published');
        await expect(submitted.getByRole('button')).toHaveText(['Unpublish']);

        await submitted.getByRole('button', { name: 'Unpublish' }).click();
        await expect(toast(page, 'Event status is now "submitted".')).toBeVisible();
        await expect(submitted.getByRole('button')).toHaveText(['Publish', 'Request changes']);

        expect(api.callsTo('PUT events /single/:id/status').map((call) => [call.params.id, call.body])).toEqual([['2', { status: 'published' }], ['2', { status: 'submitted' }]]);
    });

    test('asking for changes to a submitted event', async ({ page, api }) => {
        api.json('GET events /mine/approvable', ok([organizedEvent({ id: 2, name: 'Submitted Two', status: 'submitted' })]));
        api.json('PUT events /single/:id/status', STATUS_CHANGED);
        await page.goto('/events/change_status');

        await row(page, 'Submitted Two').getByRole('button', { name: 'Request changes' }).click();

        await expect(toast(page, 'Event status is now "draft".')).toBeVisible();
        await expect(row(page, 'Submitted Two').getByRole('button')).toHaveText(['Request approval']);
        expect(api.callsTo('PUT events /single/:id/status').map((call) => call.body)).toEqual([{ status: 'draft' }]);
    });

    test('a draft without budget or programme can\'t be sent for approval', async ({ page, api }) => {
        api.json('GET events /mine/approvable', ok([organizedEvent({ id: 1, name: 'Draft One', status: 'draft', budget: null, programme: null })]));
        await page.goto('/events/change_status');

        await row(page, 'Draft One').getByRole('button', { name: 'Request approval' }).click();

        await expect(toast(page, 'The budget for the event is not set.')).toBeVisible();
        await expect(toast(page, 'The program for the event is not set.')).toBeVisible();
        expect(api.callsTo('PUT events /single/:id/status')).toHaveLength(0);
    });

    test('an online draft only needs a programme', async ({ page, api }) => {
        api.json('GET events /mine/approvable', ok([organizedEvent({ id: 3, name: 'Online Draft', status: 'draft', method: 'online', budget: null, programme: 'https://example.org/programme' })]));
        api.json('PUT events /single/:id/status', STATUS_CHANGED);
        await page.goto('/events/change_status');

        await row(page, 'Online Draft').getByRole('button', { name: 'Request approval' }).click();

        await expect(toast(page, 'Event status is now "submitted".')).toBeVisible();
        expect(api.callsTo('PUT events /single/:id/status').map((call) => [call.params.id, call.body])).toEqual([['3', { status: 'submitted' }]]);
    });

    test('a complete draft is sent for approval', async ({ page, api }) => {
        api.json('GET events /mine/approvable', ok([organizedEvent({ id: 1, name: 'Draft One', status: 'draft' })]));
        api.json('PUT events /single/:id/status', STATUS_CHANGED);
        await page.goto('/events/change_status');

        await row(page, 'Draft One').getByRole('button', { name: 'Request approval' }).click();

        await expect(toast(page, 'Event status is now "submitted".')).toBeVisible();
        await expect(row(page, 'Draft One').getByRole('button')).toHaveText(['Publish', 'Request changes']);
        expect(api.callsTo('PUT events /single/:id/status').map((call) => call.body)).toEqual([{ status: 'submitted' }]);
    });

    test('a refused change shows the reason and keeps the status', async ({ page, api }) => {
        api.json('GET events /mine/approvable', ok([organizedEvent({ id: 2, name: 'Submitted Two', status: 'submitted' })]));
        api.on('PUT events /single/:id/status', { status: 403, json: forbidden('You are not allowed to change status.') });
        await page.goto('/events/change_status');

        await row(page, 'Submitted Two').getByRole('button', { name: 'Publish' }).click();

        await expect(toast(page, 'Could not update event status: You are not allowed to change status.')).toBeVisible();
        await expect(await cellOf(table(page), row(page, 'Submitted Two'), 'Current status')).toHaveText('Submitted');
    });

    test('failing to load the events shows the error', async ({ page, api }) => {
        api.on('GET events /mine/approvable', { abort: 'failed' });
        await page.goto('/events/change_status');

        await expect(toast(page, 'Could not fetch events list: Network Error')).toBeVisible();
    });

    test('no events to approve says there is nothing', async ({ page, api }) => {
        api.json('GET events /mine/approvable', ok([]));
        await page.goto('/events/change_status');

        await expect.poll(() => api.callsTo('GET events /mine/approvable').length).toBe(1);
        await expectEmptyTable(table(page));
    });
});
