// The campaign form (/campaigns/new, /campaigns/:id/edit) and its two variants for the campaigns
// of one body (/bodies/:body_id/campaigns/new, /bodies/:body_id/campaigns/:id/edit), which use
// the routes of that body and keep the body fixed.
import type { Page } from '@playwright/test';

import { forbidden, notFound, ok, validationError } from '../support/factories/base.ts';
import { body } from '../support/factories/core.ts';
import { bodyCampaign, campaign, campaignDetail } from '../support/factories/core-campaigns.ts';
import { mockEverything } from '../support/smoke/index.ts';
import type { ApiMock } from '../support/api-mock.ts';
import { toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const save = (page: Page) => page.getByRole('button', { name: 'Save campaign' });
const bodyPicker = (page: Page) => page.getByLabel('Autojoin body');

const ANTENNA = body({ id: 1, name: 'AEGEE-Antenna', description: 'The antenna' });
const BRUSSELS = body({ id: 2, name: 'AEGEE-Brussels', description: 'The capital' });

// The bodies the global form offers to join.
const offering = (api: ApiMock): void => {
    api.json('GET core /bodies', ok([ANTENNA, BRUSSELS]));
};

const fillIn = async (page: Page): Promise<void> => {
    await page.getByLabel('Name').fill('Autumn recruitment');
    await page.getByLabel('Description').fill('Join **us** this autumn');
    await page.getByLabel('Campaign URL').fill('autumn');
};

test.describe('creating a campaign', () => {
    test('starts from an empty, active campaign without a body', async ({ page, api }) => {
        offering(api);

        await page.goto('/campaigns/new');

        await expect(page).toHaveTitle('MyAEGEE | Create a campaign');
        await expect(page.getByLabel('Name')).toHaveValue('');
        await expect(page.getByLabel('Description')).toHaveValue('');
        await expect(page.getByLabel('Campaign URL')).toHaveValue('');
        await expect(page.getByRole('checkbox', { name: 'Active?' })).toBeChecked();
        await expect(page.getByRole('checkbox', { name: 'Active?' })).toBeDisabled();
        await expect(page.getByText('The newly created recruitment campaign should be active.')).toBeVisible();
        await expect(page.getByText('Not set.')).toBeVisible();
        await expect(bodyPicker(page)).toBeEnabled();
        expect(Object.fromEntries(api.callsTo('GET core /bodies')[0].query)).toEqual({ limit: '1000' });
        expect(api.callsTo('GET core /campaigns/:id')).toHaveLength(0);
    });

    test('previews the description and explains Markdown', async ({ page, api }) => {
        offering(api);

        await page.goto('/campaigns/new');
        await page.getByLabel('Description').fill('Join **us**');

        await expect(page.getByText('us', { exact: true })).toHaveJSProperty('tagName', 'STRONG');
        await page.getByText('Preview').getByRole('button', { name: 'More information' }).focus();
        await expect(page.getByRole('tooltip')).toContainText('More information can be found by searching for Markdown online');
    });

    test('saves the campaign with the picked body and opens it', async ({ page, api }) => {
        offering(api);
        api.json('POST core /campaigns', ok(campaign({ id: 42, autojoin_body_id: 2 })));
        api.fallback(mockEverything);

        await page.goto('/campaigns/new');
        await fillIn(page);
        await bodyPicker(page).fill('brus');
        await expect(page.getByRole('button', { name: /^AEGEE-Antenna/ })).toHaveCount(0);
        await page.getByRole('button', { name: /^AEGEE-Brussels/ }).click();
        await expect(page.getByRole('button', { name: 'AEGEE-Brussels (Click to unset)' })).toBeVisible();
        await save(page).click();

        await expect(toast(page, 'Campaign is saved.')).toBeVisible();
        await expect(page).toHaveURL('/campaigns/42');
        await expect.poll(() => api.callsTo('POST core /campaigns').map((call) => call.body)).toEqual([{
            id: null,
            name: 'Autumn recruitment',
            description_long: 'Join **us** this autumn',
            url: 'autumn',
            active: true,
            autojoin_body_id: 2,
            autojoin_body: BRUSSELS
        }]);
    });

    test('a picked body can be unset again', async ({ page, api }) => {
        offering(api);
        api.json('POST core /campaigns', ok(campaign({ id: 42, autojoin_body_id: null })));
        api.fallback(mockEverything);

        await page.goto('/campaigns/new');
        await fillIn(page);
        await bodyPicker(page).click();
        await page.getByRole('button', { name: /^AEGEE-Antenna/ }).click();
        await page.getByRole('button', { name: 'AEGEE-Antenna (Click to unset)' }).click();

        await expect(page.getByText('Not set.')).toBeVisible();
        await save(page).click();
        await expect(toast(page, 'Campaign is saved.')).toBeVisible();
        await expect.poll(() => api.callsTo('POST core /campaigns')[0].body).toMatchObject({ autojoin_body_id: null, autojoin_body: null });
    });

    test('sends nothing while a required field is empty', async ({ page, api }) => {
        offering(api);

        await page.goto('/campaigns/new');
        await page.getByLabel('Name').fill('Autumn recruitment');
        await save(page).click();

        await expect(page.getByLabel('Description')).toBeFocused();
        await page.getByLabel('Description').fill('x');
        await save(page).click();
        await expect(page.getByLabel('Campaign URL')).toBeFocused();
        expect(api.callsTo('POST core /campaigns')).toHaveLength(0);
    });

    test('shows the service\'s reasons under the fields', async ({ page, api }) => {
        offering(api);
        api.on('POST core /campaigns', {
            status: 422,
            json: validationError({
                name: ['Name should be set.'],
                description_long: ['Description should be set.'],
                url: ['url must be unique'],
                autojoin_body_id: ['The body does not exist.'],
                active: ['Active should be a boolean.']
            })
        });

        await page.goto('/campaigns/new');
        await fillIn(page);
        await save(page).click();

        await expect(toast(page, 'Some of the campaign data is invalid.')).toBeVisible();
        for (const message of ['Name should be set.', 'Description should be set.', 'url must be unique', 'The body does not exist.', 'Active should be a boolean.']) {
            await expect(page.getByText(message)).toBeVisible();
        }
        await expect(page).toHaveURL('/campaigns/new');
        await expect(save(page)).toBeEnabled();
    });

    test('a refusal says why and clears the earlier field messages', async ({ page, api }) => {
        offering(api);
        let asked = 0;
        api.on('POST core /campaigns', () => (++asked === 1
            ? { status: 422, json: validationError({ url: ['url must be unique'] }) }
            : { status: 403, json: forbidden('Permission global:create:campaign is required, but not present.') }));

        await page.goto('/campaigns/new');
        await fillIn(page);
        await save(page).click();
        await expect(page.getByText('url must be unique')).toBeVisible();
        await save(page).click();

        await expect(toast(page, 'Could not save campaign: Permission global:create:campaign is required, but not present.')).toBeVisible();
        await expect(page.getByText('url must be unique')).toHaveCount(0);
    });

    test('saving is disabled until the service answers', async ({ page, api }) => {
        offering(api);
        api.on('POST core /campaigns', { status: 500, json: { success: false, message: 'Database is down' }, delayMs: 1500 });

        await page.goto('/campaigns/new');
        await fillIn(page);
        await save(page).click();

        await expect(save(page)).toBeDisabled();
        await expect(toast(page, 'Could not save campaign: Database is down')).toBeVisible();
        await expect(save(page)).toBeEnabled();
        await expect.poll(() => api.callsTo('POST core /campaigns')).toHaveLength(1);
    });

    test('says why the bodies could not be loaded', async ({ page, api }) => {
        api.on('GET core /bodies', { status: 500, json: { success: false, message: 'Database is down' } });

        await page.goto('/campaigns/new');

        await expect(toast(page, 'Could not fetch bodies list: Database is down')).toBeVisible();
        await expect(page.getByText('Not set.')).toBeVisible();
    });
});

test.describe('editing a campaign', () => {
    const loaded = () => campaignDetail({
        id: 7,
        name: 'Autumn recruitment',
        url: 'autumn',
        description_long: 'Join us',
        description_short: 'Short',
        active: false,
        autojoin_body_id: 1,
        autojoin_body: { id: 1, name: 'AEGEE-Antenna', email: 'antenna@example.com', phone: null, address: 'Somewhere in Europe', website: null }
    });

    test('starts from the campaign as it is and saves the changes', async ({ page, api }) => {
        offering(api);
        const campaignNow = loaded();
        api.json('GET core /campaigns/:id', ok(campaignNow));
        api.json('PUT core /campaigns/:id', ok(campaign({ id: 7 })));

        await page.goto('/campaigns/7/edit');

        await expect(page).toHaveTitle('MyAEGEE | Edit single campaign');
        await expect(page.getByLabel('Name')).toHaveValue('Autumn recruitment');
        await expect(page.getByLabel('Description')).toHaveValue('Join us');
        await expect(page.getByLabel('Campaign URL')).toHaveValue('autumn');
        await expect(page.getByRole('button', { name: 'AEGEE-Antenna (Click to unset)' })).toBeVisible();
        const active = page.getByRole('checkbox', { name: 'Active?' });
        await expect(active).not.toBeChecked();
        await expect(active).toBeEnabled();
        await expect(page.getByText('The newly created recruitment campaign should be active.')).toHaveCount(0);

        await page.getByLabel('Name').fill('Winter recruitment');
        await active.check();
        api.fallback(mockEverything);
        await save(page).click();

        await expect(toast(page, 'Campaign is saved.')).toBeVisible();
        await expect(page).toHaveURL('/campaigns/7');
        await expect.poll(() => api.callsTo('GET core /campaigns/:id')[0].params).toEqual({ id: '7' });
        await expect.poll(() => api.callsTo('PUT core /campaigns/:id').map((call) => [call.params, call.body]))
            .toEqual([[{ id: '7' }, { ...campaignNow, name: 'Winter recruitment', active: true }]]);
    });

    test('a campaign that does not exist sends the member to the campaigns list', async ({ page, api }) => {
        offering(api);
        api.on('GET core /campaigns/:id', { status: 404, json: notFound('Campaign is not found.') });
        api.json('GET core /campaigns', ok([]));

        await page.goto('/campaigns/7/edit');

        await expect(toast(page, 'Campaign is not found')).toBeVisible();
        await expect(page).toHaveURL('/campaigns');
    });

    test('a failing campaign says why and sends the member to the campaigns list', async ({ page, api }) => {
        offering(api);
        api.on('GET core /campaigns/:id', { status: 500, json: { success: false, message: 'Database is down' } });
        api.json('GET core /campaigns', ok([]));

        await page.goto('/campaigns/7/edit');

        await expect(toast(page, 'Some error happened: Database is down')).toBeVisible();
        await expect(page).toHaveURL('/campaigns');
    });
});

test.describe('the campaigns of one body', () => {
    test('a new campaign joins the body of the page and is saved through it', async ({ page, api }) => {
        api.json('GET core /bodies/:id', ok(body({ id: 5, name: 'AEGEE-Brussels' })));
        api.json('POST core /bodies/:id/campaigns', ok(campaign({ id: 42, autojoin_body_id: 5 })));

        await page.goto('/bodies/5/campaigns/new');

        await expect(page).toHaveTitle('MyAEGEE | Create campaign for a body');
        await expect(page.getByText('AEGEE-Brussels', { exact: true })).toBeVisible();
        await expect(bodyPicker(page)).toBeDisabled();
        await expect(page.getByRole('button', { name: /Click to unset/ })).toHaveCount(0);
        await fillIn(page);
        api.fallback(mockEverything);
        await save(page).click();

        await expect(toast(page, 'Campaign is saved.')).toBeVisible();
        await expect(page).toHaveURL('/bodies/5/campaigns/42');
        await expect.poll(() => api.callsTo('GET core /bodies/:id')[0].params).toEqual({ id: '5' });
        const [created] = api.callsTo('POST core /bodies/:id/campaigns');
        expect(created.params).toEqual({ id: '5' });
        expect(created.body).toMatchObject({ name: 'Autumn recruitment', description_long: 'Join **us** this autumn', url: 'autumn', active: true, autojoin_body_id: 5 });
        expect(api.callsTo('POST core /campaigns')).toHaveLength(0);
    });

    test('says why the body could not be loaded', async ({ page, api }) => {
        api.on('GET core /bodies/:id', { status: 500, json: { success: false, message: 'Database is down' } });

        await page.goto('/bodies/5/campaigns/new');

        await expect(toast(page, 'Could not fetch body: Database is down')).toBeVisible();
        await expect(page.getByText('Not set.')).toBeVisible();
    });

    test('a refused new campaign says why', async ({ page, api }) => {
        api.json('GET core /bodies/:id', ok(body({ id: 5, name: 'AEGEE-Brussels' })));
        api.on('POST core /bodies/:id/campaigns', { status: 403, json: forbidden('Permission create:campaign is required, but not present.') });

        await page.goto('/bodies/5/campaigns/new');
        await fillIn(page);
        await save(page).click();

        await expect(toast(page, 'Could not save campaign: Permission create:campaign is required, but not present.')).toBeVisible();
        await expect(page).toHaveURL('/bodies/5/campaigns/new');
    });

    test('a campaign of the body is loaded and saved through the body', async ({ page, api }) => {
        const loaded = bodyCampaign({ id: 7, name: 'Autumn recruitment', url: 'autumn', autojoin_body: body({ id: 5, name: 'AEGEE-Brussels' }) });
        api.json('GET core /bodies/:id/campaigns/:campaign_id', ok(loaded));
        api.json('PUT core /bodies/:id/campaigns/:campaign_id', ok(campaign({ id: 7, autojoin_body_id: 5 })));

        await page.goto('/bodies/5/campaigns/7/edit');

        await expect(page).toHaveTitle('MyAEGEE | Edit campaign of a body');
        await expect(page.getByLabel('Name')).toHaveValue('Autumn recruitment');
        await expect(page.getByText('AEGEE-Brussels', { exact: true })).toBeVisible();
        await expect(bodyPicker(page)).toBeDisabled();
        await page.getByLabel('Campaign URL').fill('autumn-2027');
        api.fallback(mockEverything);
        await save(page).click();

        await expect(toast(page, 'Campaign is saved.')).toBeVisible();
        await expect(page).toHaveURL('/bodies/5/campaigns/7');
        await expect.poll(() => api.callsTo('GET core /bodies/:id/campaigns/:campaign_id')[0].params).toEqual({ id: '5', campaign_id: '7' });
        await expect.poll(() => api.callsTo('PUT core /bodies/:id/campaigns/:campaign_id').map((call) => [call.params, call.body]))
            .toEqual([[{ id: '5', campaign_id: '7' }, { ...loaded, url: 'autumn-2027' }]]);
        expect(api.callsTo('GET core /bodies')).toHaveLength(0);
    });

    test('a campaign the body does not have sends the member to the body\'s campaigns', async ({ page, api }) => {
        api.on('GET core /bodies/:id/campaigns/:campaign_id', { status: 404, json: notFound('Campaign is not found.') });
        api.json('GET core /bodies/:id/campaigns', ok([]));
        api.json('GET core /bodies/:id/my_permissions', ok([]));

        await page.goto('/bodies/5/campaigns/7/edit');

        await expect(toast(page, 'Campaign is not found')).toBeVisible();
        await expect(page).toHaveURL('/bodies/5/campaigns');
    });
});
