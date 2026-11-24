// The participants list of a statutory event (/statutory/:id/accepted): the accepted, not
// cancelled applications, by body, and whether each participant paid, attended and registered.
import type { Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { forbidden, notFound, ok } from '../support/factories/base.ts';
import { acceptedApplication, type AcceptedApplication } from '../support/factories/statutory-applications.ts';
import { cellOf, expectEmptyTable, tableRows, toast } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { test, expect } from '../support/test.ts';

const participant = (overrides: Partial<AcceptedApplication>) => acceptedApplication({ body_id: 1, body_name: 'AEGEE-Antenna', ...overrides });

const mockList = (api: ApiMock, applications: AcceptedApplication[]) => {
    api.json('GET statutory /events/:id/applications/accepted', ok(applications));
};

const participants = (page: Page) => page.getByRole('region', { name: 'Participants' }).getByRole('table');

test.describe('the participants list of a statutory event', () => {
    test('lists the participants by body, then by place, with what they did', async ({ page, api }) => {
        mockList(api, [
            participant({ id: 21, statutory_id: '001-0021', first_name: 'Zoe', last_name: 'Zeta', body_id: 3, body_name: 'AEGEE-Utrecht', participant_order: 1 }),
            participant({ id: 22, statutory_id: '001-0022', first_name: 'Ben', last_name: 'Beta', participant_type: 'visitor', participant_order: 1 }),
            participant({ id: 23, statutory_id: '001-0023', first_name: 'Dan', last_name: 'Delta', participant_order: 2 }),
            participant({ id: 24, statutory_id: '001-0024', first_name: 'Ann', last_name: 'Alpha', participant_order: 1, confirmed: true, attended: true, registered: true })
        ]);
        await page.goto('/statutory/agora-spring/accepted');

        await expect(page.getByRole('heading', { name: 'Accepted applications' })).toBeVisible();
        await expect(page).toHaveTitle('MyAEGEE | List accepted participants for the statutory event');
        await expect(page.getByText('Total participants accepted: 4')).toBeVisible();

        const table = participants(page);
        const rows = tableRows(table);
        await expect(rows).toHaveCount(4);
        // AEGEE-Antenna before AEGEE-Utrecht; in a body the delegates in their order, then the visitors.
        await expect(rows.nth(0)).toContainText('Ann Alpha');
        await expect(rows.nth(1)).toContainText('Dan Delta');
        await expect(rows.nth(2)).toContainText('Ben Beta');
        await expect(rows.nth(3)).toContainText('Zoe Zeta');

        const ann = rows.nth(0);
        await expect(await cellOf(table, ann, '#')).toHaveText('001-0024');
        await expect(await cellOf(table, ann, 'Name')).toHaveText('Ann Alpha');
        await expect((await cellOf(table, ann, 'Body')).getByRole('link', { name: 'AEGEE-Antenna' })).toHaveAttribute('href', '/bodies/1');
        await expect(await cellOf(table, ann, 'Participant type and order')).toHaveText('delegate (1)');
        await expect(await cellOf(table, ann, 'Confirmed?')).toHaveText('Yes');
        await expect(await cellOf(table, ann, 'Attended?')).toHaveText('Yes');
        await expect(await cellOf(table, ann, 'Registered?')).toHaveText('Yes');

        const zoe = rows.nth(3);
        await expect((await cellOf(table, zoe, 'Body')).getByRole('link', { name: 'AEGEE-Utrecht' })).toHaveAttribute('href', '/bodies/3');
        await expect(await cellOf(table, zoe, 'Confirmed?')).toHaveText('No');
        await expect(await cellOf(table, zoe, 'Attended?')).toHaveText('No');
        await expect(await cellOf(table, zoe, 'Registered?')).toHaveText('No');

        expect(api.callsTo('GET statutory /events/:id/applications/accepted').map((call) => call.params)).toEqual([{ id: 'agora-spring' }]);
    });

    test('participants without a place yet come last in their body', async ({ page, api }) => {
        mockList(api, [
            participant({ id: 31, first_name: 'Una', last_name: 'Unset', participant_type: null, participant_order: null }),
            participant({ id: 32, first_name: 'Vic', last_name: 'Visitor', participant_type: 'visitor', participant_order: 1 }),
            participant({ id: 33, first_name: 'Olga', last_name: 'Observer', participant_type: 'observer', participant_order: 1 }),
            participant({ id: 34, first_name: 'Bart', last_name: 'Later', body_id: 3, body_name: 'AEGEE-Utrecht', participant_type: 'envoy', participant_order: 1 })
        ]);
        await page.goto('/statutory/agora-spring/accepted');

        const table = participants(page);
        const rows = tableRows(table);
        await expect(rows).toHaveCount(4);
        await expect(rows.nth(0)).toContainText('Olga Observer');
        await expect(rows.nth(1)).toContainText('Vic Visitor');
        await expect(rows.nth(2)).toContainText('Una Unset');
        await expect(rows.nth(3)).toContainText('Bart Later');
        await expect(await cellOf(table, rows.nth(2), 'Participant type and order')).toHaveText('');
    });

    test('an event without accepted participants says so', async ({ page, api }) => {
        mockList(api, []);
        await page.goto('/statutory/agora-spring/accepted');

        await expect.poll(() => api.callsTo('GET statutory /events/:id/applications/accepted').length).toBe(1);
        await expectEmptyTable(participants(page));
        await expect(page.getByText('Total participants accepted: 0')).toBeVisible();
    });

    test('the table says it is loading while the participants come', async ({ page, api }) => {
        api.on('GET statutory /events/:id/applications/accepted', { json: ok([participant({})]), delayMs: 1000 });
        await page.goto('/statutory/agora-spring/accepted');

        await expect(page.getByRole('region', { name: 'Participants' })).toHaveAttribute('aria-busy', 'true');
        await expect(page.getByRole('region', { name: 'Participants' })).toHaveAttribute('aria-busy', 'false');
        await expect(tableRows(participants(page))).toHaveCount(1);
    });

    test('an unknown event goes back to the list of statutory events', async ({ page, api }) => {
        api.fallback(mockEverything);
        api.on('GET statutory /events/:id/applications/accepted', { status: 404, json: notFound('Event with such url or ID is not found.') });
        await page.goto('/statutory/nope/accepted');

        await expect(toast(page, 'Event is not found')).toBeVisible();
        await expect(page).toHaveURL('/statutory');
    });

    test('someone who may not see the participants list yet goes back to the list of statutory events', async ({ page, api }) => {
        api.fallback(mockEverything);
        api.on('GET statutory /events/:id/applications/accepted', { status: 403, json: forbidden('You are not allowed to see applications.') });
        await page.goto('/statutory/agora-spring/accepted');

        await expect(toast(page, 'Some error happened: You are not allowed to see applications.')).toBeVisible();
        await expect(page).toHaveURL('/statutory');
    });
});
