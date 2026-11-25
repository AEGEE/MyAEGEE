// The signup campaigns of a body (/bodies/:id/campaigns): what the list shows and who gets the
// link to create one.
import type { Page } from '@playwright/test';

import { forbidden, ok, okList } from '../support/factories/base.ts';
import { body } from '../support/factories/core.ts';
import { campaign } from '../support/factories/core-campaigns.ts';
import { cellOf, expectEmptyTable, permissionsFor, tableRows, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const campaignsTable = (page: Page) => page.getByRole('table');

test.describe('the campaigns of a body', () => {
    test('lists the campaigns with their description and signup link', async ({ page, api }) => {
        api.json('GET core /bodies/:id/campaigns', okList([
            campaign({ id: 7, name: 'Autumn recruitment', url: 'autumn', description_long: 'Join **us** this autumn.', autojoin_body_id: 1 }),
            campaign({ id: 8, name: 'Spring recruitment', url: 'spring', autojoin_body_id: 1 })
        ]));
        permissionsFor(api, 'bodies', 1, []);

        await page.goto('/bodies/1/campaigns');

        await expect(page).toHaveTitle('MyAEGEE | View recruitment campaigns of a body');
        await expect(page.getByRole('heading', { name: 'Recruitment campaigns list' })).toBeVisible();
        const table = campaignsTable(page);
        await expect(tableRows(table)).toHaveCount(2);
        const autumn = tableRows(table).filter({ hasText: 'Autumn recruitment' });
        await expect(autumn.getByRole('link', { name: 'Autumn recruitment' })).toHaveAttribute('href', '/bodies/1/campaigns/7');
        await expect((await cellOf(table, autumn, 'Description')).getByText('us', { exact: true })).toHaveJSProperty('tagName', 'STRONG');
        await expect(autumn.getByRole('link', { name: '/signup/autumn' })).toHaveAttribute('href', '/signup/autumn');
        await expect(page.getByRole('link', { name: 'Create campaign' })).toHaveCount(0);

        const [list] = api.callsTo('GET core /bodies/:id/campaigns');
        expect(list.params).toEqual({ id: '1' });
        expect([...list.query.keys()]).toEqual([]);
        await expect.poll(() => api.callsTo('GET core /bodies/:id/my_permissions')).toHaveLength(1);
    });

    test('those who may create campaigns for the body get a link to the form', async ({ page, api }) => {
        api.json('GET core /bodies/:id/campaigns', okList([]));
        permissionsFor(api, 'bodies', 1, ['local:create:campaign']);
        api.json('GET core /bodies/:id', ok(body({ id: 1, name: 'AEGEE-Antenna' })));

        await page.goto('/bodies/1/campaigns');
        await page.getByRole('link', { name: 'Create campaign' }).click();

        await expect(page).toHaveURL('/bodies/1/campaigns/new');
        await expect(page.getByText('AEGEE-Antenna', { exact: true })).toBeVisible();
    });

    test('shows that the campaigns are loading', async ({ page, api }) => {
        api.on('GET core /bodies/:id/campaigns', { json: okList([campaign({ name: 'Autumn recruitment' })]), delayMs: 1500 });
        permissionsFor(api, 'bodies', 1, []);

        await page.goto('/bodies/1/campaigns');

        const region = page.getByRole('region', { name: 'Campaigns of the body' });
        await expect(region).toHaveAttribute('aria-busy', 'true');
        await expect(tableRows(campaignsTable(page)).filter({ hasText: 'Autumn recruitment' })).toBeVisible();
        await expect(region).toHaveAttribute('aria-busy', 'false');
    });

    test('says so when the body has no campaigns', async ({ page, api }) => {
        api.json('GET core /bodies/:id/campaigns', okList([]));
        permissionsFor(api, 'bodies', 1, []);

        await page.goto('/bodies/1/campaigns');

        await expect.poll(() => api.callsTo('GET core /bodies/:id/my_permissions').length).toBe(1);
        await expectEmptyTable(campaignsTable(page));
    });

    test('says why the campaigns could not be loaded', async ({ page, api }) => {
        api.on('GET core /bodies/:id/campaigns', { status: 403, json: forbidden('Permission view:campaign is required, but not present.') });

        await page.goto('/bodies/1/campaigns');

        await expect(toast(page, 'Could not fetch campaign list: Permission view:campaign is required, but not present.')).toBeVisible();
        await expectEmptyTable(campaignsTable(page));
    });
});
