// The page of one signup campaign (/campaigns/:id) and its variant for a campaign of a body
// (/bodies/:body_id/campaigns/:id): what it shows, the actions for those who may manage it,
// deleting it and what the page does when core fails.
import type { Page } from '@playwright/test';

import { notFound, ok } from '../support/factories/base.ts';
import { permission, publicCampaign } from '../support/factories/core.ts';
import { campaignDetail } from '../support/factories/core-campaigns.ts';
import type { ApiMock } from '../support/api-mock.ts';
import { dialog, permissionsFor, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const row = (page: Page, header: string) => page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: header, exact: true }) });

const MANAGER = ['global:update:campaign', 'global:delete:campaign', 'global:view:member'];

// What the campaigns list asks for when the page sends the member there.
const answerList = (api: ApiMock): void => {
    api.json('GET core /campaigns', ok([]));
};

// What the campaigns of a body ask for when the page sends the member there.
const answerBodyList = (api: ApiMock): void => {
    api.json('GET core /bodies/:id/campaigns', ok([]));
    permissionsFor(api, 'bodies', 5, []);
};

test.describe('the page of a campaign', () => {
    test('shows the campaign and nothing to manage to a member', async ({ page, api }) => {
        api.json('GET core /campaigns/:id', ok(publicCampaign({
            id: 7,
            name: 'Autumn recruitment',
            url: 'autumn',
            description_long: 'Join **AEGEE-Antenna** this autumn.',
            autojoin_body: { id: 1, name: 'AEGEE-Antenna', email: 'antenna-1@example.com', phone: null, address: 'Somewhere in Europe', website: null }
        })));

        await page.goto('/campaigns/7');

        await expect(page).toHaveTitle('MyAEGEE | View single campaign');
        await expect(page.getByRole('heading', { name: 'Autumn recruitment' })).toBeVisible();
        await expect(row(page, 'Name')).toContainText('Autumn recruitment');
        await expect(row(page, 'Description').getByText('AEGEE-Antenna')).toHaveJSProperty('tagName', 'STRONG');
        await expect(row(page, 'URL')).toContainText('/signup/autumn');
        await expect(row(page, 'Body').getByRole('link', { name: 'AEGEE-Antenna' })).toHaveAttribute('href', '/bodies/1');
        await expect(row(page, 'Status')).toContainText('Active');
        await expect(page.getByRole('link', { name: 'Edit campaign details' })).toHaveCount(0);
        await expect(page.getByRole('link', { name: 'View members' })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Delete campaign' })).toHaveCount(0);

        expect(api.callsTo('GET core /campaigns/:id')[0].params).toEqual({ id: '7' });
        // Once by the menu, once by the page; no body: the answer doesn't say which one.
        await expect.poll(() => api.callsTo('GET core /my_permissions').length).toBe(2);
        expect(api.callsTo('GET core /bodies/:id/my_permissions')).toHaveLength(0);
    });

    test('an inactive campaign without a body says so', async ({ page, api }) => {
        api.json('GET core /campaigns/:id', ok(publicCampaign({ id: 7, active: false, autojoin_body: null })));

        await page.goto('/campaigns/7');

        await expect(row(page, 'Body')).toContainText('This campaign will not create a join request to a body after signup');
        await expect(row(page, 'Status')).toContainText('Inactive');
    });

    test('a campaign manager gets the actions, also with the body\'s permissions asked for', async ({ page, api, myPermissions }) => {
        myPermissions.push(...['global:create:campaign', ...MANAGER].map(permission));
        api.json('GET core /campaigns/:id', ok(campaignDetail({ id: 7, autojoin_body_id: 1 })));
        permissionsFor(api, 'bodies', 1, []);

        await page.goto('/campaigns/7');

        await expect(page.getByRole('link', { name: 'Edit campaign details' })).toHaveAttribute('href', '/campaigns/7/edit');
        await expect(page.getByRole('link', { name: 'View members' })).toHaveAttribute('href', '/campaigns/7/members');
        await expect(page.getByRole('button', { name: 'Delete campaign' })).toBeVisible();
        expect(api.callsTo('GET core /bodies/:id/my_permissions').map((call) => call.path)).toEqual(['/bodies/1/my_permissions']);
    });

    test('a manager deletes the campaign after confirming', async ({ page, api, myPermissions }) => {
        myPermissions.push(...MANAGER.map(permission));
        api.json('GET core /campaigns/:id', ok(publicCampaign({ id: 7 })));
        api.json('DELETE core /campaigns/:id', { success: true, message: 'Campaign is deleted.' });
        answerList(api);

        await page.goto('/campaigns/7');
        await page.getByRole('button', { name: 'Delete campaign' }).click();
        const confirm = dialog(page, 'Deleting a campaign');
        await expect(confirm).toContainText('Are you sure you want to delete this campaign? This action cannot be undone.');
        await confirm.getByRole('button', { name: 'Cancel' }).click();
        await expect(confirm).toBeHidden();
        expect(api.callsTo('DELETE core /campaigns/:id')).toHaveLength(0);

        await page.getByRole('button', { name: 'Delete campaign' }).click();
        await dialog(page, 'Deleting a campaign').getByRole('button', { name: 'Delete campaign' }).click();

        await expect(toast(page, 'Campaign is deleted.')).toBeVisible();
        await expect(page).toHaveURL('/campaigns');
        expect(api.callsTo('DELETE core /campaigns/:id').map((call) => call.params)).toEqual([{ id: '7' }]);
    });

    test('a refused delete says why and stays on the campaign', async ({ page, api, myPermissions }) => {
        myPermissions.push(...MANAGER.map(permission));
        api.json('GET core /campaigns/:id', ok(publicCampaign({ id: 7, name: 'Autumn recruitment' })));
        api.on('DELETE core /campaigns/:id', { status: 500, json: { success: false, message: 'Database is down' } });

        await page.goto('/campaigns/7');
        await page.getByRole('button', { name: 'Delete campaign' }).click();
        await dialog(page, 'Deleting a campaign').getByRole('button', { name: 'Delete campaign' }).click();

        await expect(toast(page, 'Could not delete campaign: Database is down')).toBeVisible();
        await expect(page).toHaveURL('/campaigns/7');
        await expect(page.getByRole('heading', { name: 'Autumn recruitment' })).toBeVisible();
    });

    test('a campaign that does not exist sends the member to the campaigns list', async ({ page, api }) => {
        api.on('GET core /campaigns/:id', { status: 404, json: notFound('Campaign is not found.') });
        answerList(api);

        await page.goto('/campaigns/7');

        await expect(toast(page, 'Campaign is not found')).toBeVisible();
        await expect(page).toHaveURL('/campaigns');
    });

    test('a failing campaign says why and sends the member to the campaigns list', async ({ page, api }) => {
        api.on('GET core /campaigns/:id', { status: 500, json: { success: false, message: 'Database is down' } });
        answerList(api);

        await page.goto('/campaigns/7');

        await expect(toast(page, 'Some error happened: Database is down')).toBeVisible();
        await expect(page).toHaveURL('/campaigns');
    });

    test('failing permissions say why and keep the campaign', async ({ page, api, myPermissions }) => {
        api.json('GET core /campaigns/:id', ok(publicCampaign({ id: 7, name: 'Autumn recruitment' })));
        // The first answer is for the app, which logs a member out without it; the page's fails.
        let asked = 0;
        api.on('GET core /my_permissions', () => (++asked === 1
            ? { json: ok(myPermissions) }
            : { status: 500, json: { success: false, message: 'Database is down' } }));

        await page.goto('/campaigns/7');

        await expect(toast(page, 'Could not fetch your permissions for this campaign: Database is down')).toBeVisible();
        await expect(page).toHaveURL('/campaigns/7');
        await expect(page.getByRole('heading', { name: 'Autumn recruitment' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Delete campaign' })).toHaveCount(0);
    });
});

test.describe('the page of a campaign of a body', () => {
    test('links to the body\'s own pages for editing it and for its members', async ({ page, api, myPermissions }) => {
        myPermissions.push(...MANAGER.map(permission));
        // Without global:create:campaign the answer doesn't say which body the campaign joins.
        api.json('GET core /campaigns/:id', ok(publicCampaign({ id: 7 })));

        await page.goto('/bodies/5/campaigns/7');

        await expect(page).toHaveTitle('MyAEGEE | Display campaign of a body');
        await expect(page.getByRole('link', { name: 'Edit campaign details' })).toHaveAttribute('href', '/bodies/5/campaigns/7/edit');
        await expect(page.getByRole('link', { name: 'View members' })).toHaveAttribute('href', '/bodies/5/campaigns/7/members');
    });

    test('deleting it goes through the body and back to the body\'s campaigns', async ({ page, api, myPermissions }) => {
        myPermissions.push(...MANAGER.map(permission));
        api.json('GET core /campaigns/:id', ok(publicCampaign({ id: 7 })));
        api.json('DELETE core /bodies/:id/campaigns/:campaign_id', { success: true, message: 'Campaign is deleted.' });
        answerBodyList(api);

        await page.goto('/bodies/5/campaigns/7');
        await page.getByRole('button', { name: 'Delete campaign' }).click();
        await dialog(page, 'Deleting a campaign').getByRole('button', { name: 'Delete campaign' }).click();

        await expect(toast(page, 'Campaign is deleted.')).toBeVisible();
        await expect(page).toHaveURL('/bodies/5/campaigns');
        expect(api.callsTo('DELETE core /bodies/:id/campaigns/:campaign_id').map((call) => call.params)).toEqual([{ id: '5', campaign_id: '7' }]);
        expect(api.callsTo('DELETE core /campaigns/:id')).toHaveLength(0);
    });

    test('a campaign that does not exist sends the member to the body\'s campaigns', async ({ page, api }) => {
        api.on('GET core /campaigns/:id', { status: 404, json: notFound('Campaign is not found.') });
        answerBodyList(api);

        await page.goto('/bodies/5/campaigns/7');

        await expect(toast(page, 'Campaign is not found')).toBeVisible();
        await expect(page).toHaveURL('/bodies/5/campaigns');
    });
});
