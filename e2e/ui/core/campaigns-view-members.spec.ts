// Who signed up through a campaign (/campaigns/:id/members), and the same for a campaign of a
// body (/bodies/:body_id/campaigns/:id/members), which asks through that body.
import type { Page } from '@playwright/test';

import { forbidden, iso, okList, ok } from '../support/factories/base.ts';
import { publicCampaign } from '../support/factories/core.ts';
import { bodyCampaign } from '../support/factories/core-campaigns.ts';
import { memberListItem, type MemberListItem } from '../support/factories/core-members.ts';
import type { ApiMock } from '../support/api-mock.ts';
import { cellOf, expectEmptyTable, sortBy, tableRows, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const membersTable = (page: Page) => page.getByRole('table');
const search = (page: Page) => page.getByLabel('Search by name or surname');

const signedUp = (id: number, first: string, last: string, confirmed = true): MemberListItem => memberListItem({
    id, first_name: first, last_name: last, campaign_id: 7, primary_body_id: null, mail_confirmed_at: confirmed ? iso(-1) : null
});

const JANE = signedUp(52, 'Jane', 'Doe');
const JOHN = signedUp(51, 'John', 'Roe', false);

const answer = (api: ApiMock, members: MemberListItem[] = [JANE, JOHN], count = members.length): void => {
    api.json('GET core /campaigns/:id', ok(publicCampaign({ id: 7, name: 'Autumn recruitment' })));
    api.json('GET core /campaigns/:id/members', okList(members, count));
};

test.describe('the members of a campaign', () => {
    test('lists who signed up, newest first, with whether they confirmed their address', async ({ page, api }) => {
        answer(api);

        await page.goto('/campaigns/7/members');

        await expect(page).toHaveTitle('MyAEGEE | View campaign members');
        await expect(page.getByRole('heading', { name: 'Autumn recruitment' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Campaign submissions' })).toBeVisible();
        const table = membersTable(page);
        await expect(tableRows(table)).toHaveCount(2);
        await expect(tableRows(table).first()).toContainText('Jane Doe');
        const jane = tableRows(table).filter({ hasText: 'Jane Doe' });
        await expect(await cellOf(table, jane, '#')).toHaveText('52');
        await expect(jane.getByRole('link', { name: 'Jane Doe' })).toHaveAttribute('href', '/members/52');
        await expect(await cellOf(table, jane, 'Email confirmed?')).toHaveText('Yes');
        await expect(await cellOf(table, tableRows(table).filter({ hasText: 'John Roe' }), 'Email confirmed?')).toHaveText('No');
        await expect(page.getByRole('button', { name: /^Page 2\b/ })).toHaveCount(0);

        await expect.poll(() => api.callsTo('GET core /campaigns/:id')[0].params).toEqual({ id: '7' });
        const [members] = api.callsTo('GET core /campaigns/:id/members');
        expect(members.params).toEqual({ id: '7' });
        expect(Object.fromEntries(members.query)).toEqual({ limit: '30', offset: '0', sort: 'id', direction: 'desc' });
    });

    test('says so when nobody signed up', async ({ page, api }) => {
        answer(api, []);

        await page.goto('/campaigns/7/members');

        await expect.poll(() => api.callsTo('GET core /campaigns/:id/members').length).toBe(1);
        await expectEmptyTable(membersTable(page));
    });

    test('searching asks again with the text', async ({ page, api }) => {
        api.json('GET core /campaigns/:id', ok(publicCampaign({ id: 7 })));
        // Slow answers, so each keystroke cancels the request of the one before.
        api.on('GET core /campaigns/:id/members', ({ query }) => ({ json: okList(query.get('query') === 'jan' ? [JANE] : [JANE, JOHN]), delayMs: 500 }));

        await page.goto('/campaigns/7/members');
        const table = membersTable(page);
        await expect(tableRows(table)).toHaveCount(2);
        await search(page).pressSequentially('jan', { delay: 100 });

        await expect(tableRows(table)).toHaveCount(1);
        expect(Object.fromEntries(api.callsTo('GET core /campaigns/:id/members').at(-1)!.query)).toEqual({ limit: '30', offset: '0', sort: 'id', direction: 'desc', query: 'jan' });
        // Each keystroke cancels the request before it: no error for those. Counted at once, as a
        // toast that was shown is gone again after three seconds.
        expect(await toast(page, 'Could not fetch campaign members').count()).toBe(0);

        await search(page).fill('');

        await expect(tableRows(table)).toHaveCount(2);
        await expect.poll(() => api.callsTo('GET core /campaigns/:id/members').at(-1)!.query.has('query')).toBe(false);
    });

    test('more than one page of submissions is shown page by page', async ({ page, api }) => {
        const first = Array.from({ length: 30 }, (_, index) => signedUp(100 - index, 'Member', `Number ${100 - index}`));
        api.json('GET core /campaigns/:id', ok(publicCampaign({ id: 7 })));
        api.on('GET core /campaigns/:id/members', ({ query }) => ({
            json: okList(query.get('offset') === '30' ? [signedUp(60, 'Last', 'Member')] : first, 31)
        }));

        await page.goto('/campaigns/7/members');
        const table = membersTable(page);
        await expect(tableRows(table)).toHaveCount(30);
        await expect(page.getByRole('button', { name: /^Page 2\b/ })).toBeVisible();
        await expect(page.getByRole('button', { name: /^Page 3\b/ })).toHaveCount(0);
        await page.getByRole('button', { name: 'Next page' }).click();

        await expect(tableRows(table)).toHaveCount(1);
        await expect(tableRows(table).first()).toContainText('Last Member');
        expect(Object.fromEntries(api.callsTo('GET core /campaigns/:id/members').at(-1)!.query)).toEqual({ limit: '30', offset: '30', sort: 'id', direction: 'desc' });
    });

    test('sorting asks the service for that order, from the first page', async ({ page, api, layout }) => {
        answer(api);

        await page.goto('/campaigns/7/members');
        const table = membersTable(page);
        await expect(tableRows(table)).toHaveCount(2);
        await sortBy(table, 'Email confirmed?', layout);

        await expect.poll(() => api.callsTo('GET core /campaigns/:id/members').length).toBe(2);
        expect(Object.fromEntries(api.callsTo('GET core /campaigns/:id/members').at(-1)!.query)).toEqual({ limit: '30', offset: '0', sort: 'mail_confirmed_at', direction: 'asc' });

        await sortBy(table, 'User', layout);
        await expect.poll(() => api.callsTo('GET core /campaigns/:id/members').at(-1)!.query.get('sort')).toBe('first_name');
    });

    test('says why the members could not be loaded', async ({ page, api }) => {
        api.json('GET core /campaigns/:id', ok(publicCampaign({ id: 7 })));
        api.on('GET core /campaigns/:id/members', { status: 403, json: forbidden('Permission global:view:member is required, but not present.') });

        await page.goto('/campaigns/7/members');

        await expect(toast(page, 'Could not fetch campaign members: Permission global:view:member is required, but not present.')).toBeVisible();
        await expectEmptyTable(membersTable(page));
    });

    test('lists the members also when the campaign could not be loaded', async ({ page, api }) => {
        api.on('GET core /campaigns/:id', { status: 500, json: { success: false, message: 'Something went wrong on the server.' } });
        api.json('GET core /campaigns/:id/members', okList([JANE]));

        await page.goto('/campaigns/7/members');

        await expect(toast(page, 'Could not fetch campaign: Something went wrong on the server.')).toBeVisible();
        await expect(tableRows(membersTable(page)).filter({ hasText: 'Jane Doe' })).toBeVisible();
    });
});

test.describe('the members of a campaign of a body', () => {
    test('asks for the campaign and its members through the body', async ({ page, api }) => {
        api.json('GET core /bodies/:id/campaigns/:campaign_id', ok(bodyCampaign({ id: 7, name: 'Autumn recruitment', autojoin_body_id: 5 })));
        api.json('GET core /bodies/:id/campaigns/:campaign_id/members', okList([JANE]));

        await page.goto('/bodies/5/campaigns/7/members');

        await expect(page).toHaveTitle('MyAEGEE | View members of a body campaign');
        await expect(page.getByRole('heading', { name: 'Autumn recruitment' })).toBeVisible();
        await expect(tableRows(membersTable(page)).filter({ hasText: 'Jane Doe' })).toBeVisible();
        await expect.poll(() => api.callsTo('GET core /bodies/:id/campaigns/:campaign_id')[0].params).toEqual({ id: '5', campaign_id: '7' });
        const [members] = api.callsTo('GET core /bodies/:id/campaigns/:campaign_id/members');
        expect(members.params).toEqual({ id: '5', campaign_id: '7' });
        expect(Object.fromEntries(members.query)).toEqual({ limit: '30', offset: '0', sort: 'id', direction: 'desc' });
        expect(api.callsTo('GET core /campaigns/:id/members')).toHaveLength(0);
    });
});
