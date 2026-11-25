// Service page of a statutory event (/statutory/:id/debug): every permission the viewer has for
// the event, as the statutory service computed it. Only reached by typing its address.
import { notFound, ok } from '../support/factories/base.ts';
import { statutoryEvent, statutoryOrganiserPermissions } from '../support/factories/statutory-events.ts';
import { cellOf, sortBy, tableRows, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

test.describe('statutory event service page', () => {
    test('lists every permission of the viewer for the event, with nested ones in full', async ({ page, api }) => {
        api.json('GET statutory /events/:id', ok(statutoryEvent({ url: 'agora-spring', permissions: statutoryOrganiserPermissions() })));

        await page.goto('/statutory/agora-spring/debug');

        await expect(page.getByRole('heading', { name: 'Statutory service page' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Permissions' })).toBeVisible();
        const table = page.getByRole('table');
        const row = (key: string) => tableRows(table).filter({ has: page.getByText(key, { exact: true }) });
        await expect(await cellOf(table, row('edit_event'), 'Value')).toHaveText('Yes');
        await expect(await cellOf(table, row('use_massmailer'), 'Value')).toHaveText('No');
        await expect(await cellOf(table, row('create_event.spm'), 'Value')).toHaveText('Yes');
        await expect(await cellOf(table, row('export.openslides'), 'Value')).toHaveText('No');
        await expect(await cellOf(table, row('see_boardview.global'), 'Value')).toHaveText('No');
        await expect(await cellOf(table, row('apply_from_body.1'), 'Value')).toHaveText('Yes');
        await expect(row('export')).toHaveCount(0);
        expect(api.callsTo('GET statutory /events/:id').map((call) => call.params.id)).toEqual(['agora-spring']);
    });

    test('sorting by value puts what the viewer may not do first', async ({ page, api, layout }) => {
        api.json('GET statutory /events/:id', ok(statutoryEvent({
            url: 'agora-spring',
            permissions: statutoryOrganiserPermissions({ apply: false, apply_from_body: {} })
        })));

        await page.goto('/statutory/agora-spring/debug');
        const table = page.getByRole('table');
        await expect(tableRows(table).first()).toContainText('create_event.agora');

        await sortBy(table, 'Value', layout);
        await expect(await cellOf(table, tableRows(table).first(), 'Value')).toHaveText('No');
        await expect(await cellOf(table, tableRows(table).last(), 'Value')).toHaveText('Yes');
    });

    test('an unknown event goes back to the list', async ({ page, api }) => {
        api.on('GET statutory /events/:id', { status: 404, json: notFound('Event with such url or ID is not found.') });
        api.json('GET statutory /', ok([]));

        await page.goto('/statutory/no-such-event/debug');

        await expect(toast(page, 'Event is not found')).toBeVisible();
        await expect(page).toHaveURL('/statutory');
    });

    test('a failing service goes back to the list', async ({ page, api }) => {
        api.on('GET statutory /events/:id', { status: 500, json: { success: false, message: 'Internal server error.' } });
        api.json('GET statutory /', ok([]));

        await page.goto('/statutory/agora-spring/debug');

        await expect(toast(page, 'Some error happened: Internal server error.')).toBeVisible();
        await expect(page).toHaveURL('/statutory');
    });
});
