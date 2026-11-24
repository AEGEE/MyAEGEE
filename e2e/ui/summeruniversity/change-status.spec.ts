// Change SU statuses (/summeruniversity/change_status): SUCT's list of the Summer Universities
// they approve, with their status, publication and application period.
import type { Locator, Page } from '@playwright/test';

import { forbidden, ok } from '../support/factories/base.ts';
import { suEvent, type SuEvent, type SuStatus } from '../support/factories/summeruniversity.ts';
import { cellOf, dialog, expectEmptyTable, tableRows, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const STATUS_CHANGED = { success: true, message: 'Successfully changed approval status' };
const PUBLICATION_CHANGED = { success: true, message: 'Successfully changed publication status' };

const list = (page: Page) => page.getByRole('table');
const rowOf = (page: Page, name: string) => tableRows(list(page)).filter({ hasText: name });
const cell = async (page: Page, row: Locator, column: string) => cellOf(list(page), row, column);

// The status buttons a row has, in the order of the page.
const STATUS_BUTTONS = [
    'Submit first draft', 'Submit second draft', 'Approve first submission', 'Approve second submission', 'Reject first submission', 'Reject second submission'
];

const showList = (api: import('../support/api-mock.ts').ApiMock, events: SuEvent[]) => {
    api.json('GET summeruniversity /mine/approvable', ok(events));
};

test.describe('Summer University statuses', () => {
    test('lists the SUs, latest start first, with the status changes of each status', async ({ page, api }) => {
        const statuses: [string, SuStatus, string[]][] = [
            ['Alpine SU', 'first draft', ['Submit first draft']],
            ['Baltic SU', 'first submission', ['Approve first submission', 'Reject first submission']],
            ['Coastal SU', 'first approval', ['Submit second draft']],
            ['Desert SU', 'second draft', ['Submit second draft']],
            ['Eastern SU', 'second submission', ['Approve second submission', 'Reject second submission']],
            ['Forest SU', 'second approval', []]
        ];
        showList(api, statuses.map(([name, status], index) => suEvent({
            id: 10 + index,
            name,
            url: name.toLowerCase().replace(' ', '-'),
            status,
            published: 'none',
            // Alpine SU starts first, so it is listed last.
            starts: `2027-07-0${index + 1}T08:00:00.000Z`,
            ends: `2027-07-1${index + 1}T08:00:00.000Z`
        })));
        await page.goto('/summeruniversity/change_status');

        await expect(tableRows(list(page))).toHaveCount(6);
        await expect(tableRows(list(page)).getByRole('link', { name: / SU$/ })).toHaveText(['Forest SU', 'Eastern SU', 'Desert SU', 'Coastal SU', 'Baltic SU', 'Alpine SU']);

        for (const [name, status, buttons] of statuses) {
            const row = rowOf(page, name);
            await expect(await cell(page, row, 'Current status')).toHaveText(status.charAt(0).toUpperCase() + status.slice(1));
            for (const button of STATUS_BUTTONS) {
                await expect(row.getByRole('button', { name: button })).toHaveCount(buttons.includes(button) ? 1 : 0);
            }
        }
    });

    test('shows what each row is about', async ({ page, api }) => {
        showList(api, [suEvent({
            id: 12,
            name: 'Alpine SU',
            url: 'alpine-su',
            type: 'pilot',
            organizing_bodies: [{ body_id: 1, body_name: 'AEGEE-Antenna' }, { body_id: 2, body_name: 'AEGEE-Other' }],
            starts: '2027-07-01T08:00:00.000Z',
            ends: '2027-07-14T08:00:00.000Z',
            status: 'second approval',
            published: 'full',
            application_status: 'closed'
        }), suEvent({ id: 13, name: 'No Url SU', url: null })]);
        await page.goto('/summeruniversity/change_status');

        const row = rowOf(page, 'Alpine SU');
        await expect(await cell(page, row, 'Event type')).toHaveText('Pilot SU');
        await expect(row.getByRole('link', { name: 'Alpine SU' })).toHaveAttribute('href', '/summeruniversity/alpine-su');
        await expect(row.getByRole('link', { name: 'AEGEE-Antenna' })).toHaveAttribute('href', '/bodies/1');
        await expect(row.getByRole('link', { name: 'AEGEE-Other' })).toHaveAttribute('href', '/bodies/2');
        await expect(await cell(page, row, 'Event dates')).toHaveText('2027-07-01 - 2027-07-14');
        await expect(await cell(page, row, 'Current publication')).toHaveText('Full');
        await expect(await cell(page, row, 'Current application status')).toHaveText('Closed');
        // An SU without a URL is linked by its id.
        await expect(rowOf(page, 'No Url SU').getByRole('link', { name: 'No Url SU' })).toHaveAttribute('href', '/summeruniversity/13');
    });

    test('changing a status updates the row', async ({ page, api }) => {
        showList(api, [suEvent({ id: 21, name: 'Baltic SU', status: 'first submission', published: 'none' })]);
        api.json('PUT summeruniversity /single/:id/status', STATUS_CHANGED);
        await page.goto('/summeruniversity/change_status');

        const row = rowOf(page, 'Baltic SU');
        await row.getByRole('button', { name: 'Approve first submission' }).click();

        await expect(toast(page, 'Event status is now "first approval".')).toBeVisible();
        await expect(await cell(page, row, 'Current status')).toHaveText('First approval');
        await expect(row.getByRole('button', { name: 'Submit second draft' })).toBeVisible();
        await expect(row.getByRole('button', { name: 'Approve first submission' })).toHaveCount(0);
        expect(api.callsTo('PUT summeruniversity /single/:id/status').map((call) => [call.params.id, call.body])).toEqual([['21', { status: 'first approval' }]]);
    });

    test('a refused status change shows the error and keeps the status', async ({ page, api }) => {
        showList(api, [suEvent({ id: 21, name: 'Baltic SU', status: 'first submission', published: 'none' })]);
        api.on('PUT summeruniversity /single/:id/status', { status: 403, json: forbidden('You are not allowed to change status.') });
        await page.goto('/summeruniversity/change_status');

        const row = rowOf(page, 'Baltic SU');
        await row.getByRole('button', { name: 'Reject first submission' }).click();

        await expect(toast(page, 'Could not update event status: You are not allowed to change status.')).toBeVisible();
        await expect(await cell(page, row, 'Current status')).toHaveText('First submission');
        expect(api.callsTo('PUT summeruniversity /single/:id/status').map((call) => call.body)).toEqual([{ status: 'first draft' }]);
    });

    test('rejecting a submission keeps the SU\'s publication', async ({ page, api }) => {
        // Only a move back from an approval (first approval to first submission, second approval
        // to second submission) unpublishes an SU; rejecting a submission leaves it as it is.
        showList(api, [suEvent({ id: 22, name: 'Eastern SU', status: 'second submission', published: 'minimal' })]);
        api.json('PUT summeruniversity /single/:id/status', STATUS_CHANGED);
        await page.goto('/summeruniversity/change_status');

        const row = rowOf(page, 'Eastern SU');
        await row.getByRole('button', { name: 'Reject second submission' }).click();

        await expect(toast(page, 'Event status is now "second draft".')).toBeVisible();
        await expect(await cell(page, row, 'Current status')).toHaveText('Second draft');
        await expect(await cell(page, row, 'Current publication')).toHaveText('Minimal');
        await expect(row.getByRole('button', { name: 'Unpublish event' })).toBeVisible();
        expect(api.callsTo('PUT summeruniversity /single/:id/status').map((call) => call.body)).toEqual([{ status: 'second draft' }]);
    });

    test('publishing as minimal, then in full, then unpublishing', async ({ page, api }) => {
        showList(api, [suEvent({ id: 23, name: 'Forest SU', status: 'second approval', published: 'none' })]);
        api.json('PUT summeruniversity /single/:id/published', PUBLICATION_CHANGED);
        await page.goto('/summeruniversity/change_status');

        const row = rowOf(page, 'Forest SU');
        await expect(row.getByRole('button', { name: 'Unpublish event' })).toHaveCount(0);
        await expect(row.getByRole('button', { name: 'Publish full event' })).toHaveCount(0);
        await row.getByRole('button', { name: 'Publish minimal event' }).click();

        await expect(toast(page, 'Event publication is now "minimal".')).toBeVisible();
        await expect(await cell(page, row, 'Current publication')).toHaveText('Minimal');
        await expect(row.getByRole('button', { name: 'Publish minimal event' })).toHaveCount(0);
        await row.getByRole('button', { name: 'Publish full event' }).click();

        await expect(toast(page, 'Event publication is now "full".')).toBeVisible();
        await expect(await cell(page, row, 'Current publication')).toHaveText('Full');
        await expect(row.getByRole('button', { name: 'Publish full event' })).toHaveCount(0);
        await row.getByRole('button', { name: 'Unpublish event' }).click();

        await expect(toast(page, 'Event publication is now "none".')).toBeVisible();
        await expect(await cell(page, row, 'Current publication')).toHaveText('None');
        await expect(row.getByRole('button', { name: 'Publish minimal event' })).toBeVisible();
        expect(api.callsTo('PUT summeruniversity /single/:id/published').map((call) => [call.params.id, call.body]))
            .toEqual([['23', { published: 'minimal' }], ['23', { published: 'full' }], ['23', { published: 'none' }]]);
    });

    test('a refused publication shows the error and keeps the publication', async ({ page, api }) => {
        showList(api, [suEvent({ id: 24, name: 'Coastal SU', status: 'first approval', published: 'minimal' })]);
        api.on('PUT summeruniversity /single/:id/published', { status: 403, json: forbidden('This event status does not allow a full publication') });
        await page.goto('/summeruniversity/change_status');

        const row = rowOf(page, 'Coastal SU');
        await row.getByRole('button', { name: 'Publish full event' }).click();

        await expect(toast(page, 'Could not update event publication: This event status does not allow a full publication')).toBeVisible();
        await expect(await cell(page, row, 'Current publication')).toHaveText('Minimal');
    });

    test.describe('application period', () => {
        const OPEN = suEvent({
            id: 25,
            name: 'Forest SU',
            status: 'second approval',
            published: 'full',
            application_status: 'closed',
            // 09:00 UTC is 10:00 in Brussels in winter, 08:00 UTC is 10:00 in summer.
            application_starts: '2027-03-01T09:00:00.000Z',
            application_ends: '2027-04-30T08:00:00.000Z'
        });

        test('the dialog shows the dates in local time and saves both', async ({ page, api }) => {
            showList(api, [OPEN]);
            api.on('PUT summeruniversity /single/:id/application_period', ({ body }) => ({
                json: { success: true, message: 'Successfully changed application period', data: { ...OPEN, ...(body as object), application_status: 'open' } }
            }));
            await page.goto('/summeruniversity/change_status');

            const row = rowOf(page, 'Forest SU');
            await row.getByRole('button', { name: 'Change application period' }).click();
            const modal = dialog(page, 'Set application period');
            await expect(modal.getByLabel('Application starts')).toHaveValue('2027-03-01T10:00');
            await expect(modal.getByLabel('Application ends')).toHaveValue('2027-04-30T10:00');
            await expect(modal).toContainText('(Europe/Brussels)');

            await modal.getByLabel('Application ends').fill('2027-05-15T12:00');
            await modal.getByRole('button', { name: 'Save' }).click();

            await expect(toast(page, 'Event application period was updated.')).toBeVisible();
            await expect(modal).toBeHidden();
            // The row takes the SU as the service answers it.
            await expect(await cell(page, row, 'Current application status')).toHaveText('Open');
            expect(api.callsTo('PUT summeruniversity /single/:id/application_period').map((call) => [call.params.id, call.body])).toEqual([['25', {
                application_starts: '2027-03-01T09:00:00.000Z',
                application_ends: '2027-05-15T10:00:00.000Z'
            }]]);
        });

        test('without a start the period starts when it is saved', async ({ page, api }) => {
            showList(api, [{ ...OPEN, application_starts: null, application_ends: null }]);
            api.on('PUT summeruniversity /single/:id/application_period', ({ body }) => ({
                json: { success: true, message: 'Successfully changed application period', data: { ...OPEN, ...(body as object) } }
            }));
            await page.goto('/summeruniversity/change_status');

            await rowOf(page, 'Forest SU').getByRole('button', { name: 'Change application period' }).click();
            const modal = dialog(page, 'Set application period');
            await expect(modal.getByLabel('Application starts')).toHaveValue('');
            await expect(modal.getByLabel('Application ends')).toHaveValue('');
            await expect(modal).toContainText('Leave empty to start immediately.');

            await modal.getByLabel('Application ends').fill('2027-05-15T12:00');
            await modal.getByRole('button', { name: 'Save' }).click();

            await expect(toast(page, 'Event application period was updated.')).toBeVisible();
            expect(api.callsTo('PUT summeruniversity /single/:id/application_period').map((call) => call.body))
                .toEqual([{ application_ends: '2027-05-15T10:00:00.000Z' }]);
        });

        test('a start after the end is refused before sending', async ({ page, api }) => {
            showList(api, [OPEN]);
            await page.goto('/summeruniversity/change_status');

            await rowOf(page, 'Forest SU').getByRole('button', { name: 'Change application period' }).click();
            const modal = dialog(page, 'Set application period');
            await modal.getByLabel('Application starts').fill('2027-05-01T10:00');
            await modal.getByLabel('Application ends').fill('2027-05-01T10:00');
            await modal.getByRole('button', { name: 'Save' }).click();

            await expect(toast(page, 'Application start must be before application end.')).toBeVisible();
            await expect(modal).toBeVisible();
            expect(api.callsTo('PUT summeruniversity /single/:id/application_period')).toHaveLength(0);
        });

        test('a refused period keeps the dialog open', async ({ page, api }) => {
            showList(api, [OPEN]);
            api.on('PUT summeruniversity /single/:id/application_period', {
                status: 403, json: forbidden('This event status does not allow changing the application period')
            });
            await page.goto('/summeruniversity/change_status');

            const row = rowOf(page, 'Forest SU');
            await row.getByRole('button', { name: 'Change application period' }).click();
            const modal = dialog(page, 'Set application period');
            await modal.getByRole('button', { name: 'Save' }).click();

            await expect(toast(page, 'Could not update event application period: This event status does not allow changing the application period')).toBeVisible();
            await expect(modal).toBeVisible();
            await expect(modal.getByRole('button', { name: 'Save' })).toBeEnabled();
            await expect(await cell(page, row, 'Current application status')).toHaveText('Closed');
        });

        test('Cancel and the close button send nothing', async ({ page, api }) => {
            showList(api, [OPEN]);
            await page.goto('/summeruniversity/change_status');

            const row = rowOf(page, 'Forest SU');
            await row.getByRole('button', { name: 'Change application period' }).click();
            await dialog(page, 'Set application period').getByRole('button', { name: 'Cancel' }).click();
            await expect(dialog(page, 'Set application period')).toBeHidden();

            await row.getByRole('button', { name: 'Change application period' }).click();
            await dialog(page, 'Set application period').getByRole('button', { name: 'close' }).click();
            await expect(dialog(page, 'Set application period')).toBeHidden();
            expect(api.callsTo('PUT summeruniversity /single/:id/application_period')).toHaveLength(0);
        });

        test('the end is required', async ({ page, api }) => {
            showList(api, [OPEN]);
            await page.goto('/summeruniversity/change_status');

            await rowOf(page, 'Forest SU').getByRole('button', { name: 'Change application period' }).click();
            const modal = dialog(page, 'Set application period');
            await modal.getByLabel('Application ends').fill('');
            await modal.getByRole('button', { name: 'Save' }).click();

            expect(await modal.getByLabel('Application ends').evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
            await expect(modal).toBeVisible();
            expect(api.callsTo('PUT summeruniversity /single/:id/application_period')).toHaveLength(0);
        });
    });

    test('without SUs to approve the table says so', async ({ page, api }) => {
        showList(api, []);
        await page.goto('/summeruniversity/change_status');

        await expect.poll(() => api.callsTo('GET summeruniversity /mine/approvable')).toHaveLength(1);
        await expectEmptyTable(list(page));
    });

    test('a failed request shows the error', async ({ page, api }) => {
        api.on('GET summeruniversity /mine/approvable', { abort: 'failed' });
        await page.goto('/summeruniversity/change_status');

        await expect(toast(page, 'Could not fetch events list: Network Error')).toBeVisible();
        await expectEmptyTable(list(page));
    });
});
