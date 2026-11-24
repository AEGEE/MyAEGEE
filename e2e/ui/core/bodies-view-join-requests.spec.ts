// The join requests of a body (/bodies/:id/join_requests): listing and filtering them, and
// approving or rejecting one.
import type { Page } from '@playwright/test';

import { badRequest, forbidden, okList } from '../support/factories/base.ts';
import { joinRequest, type JoinRequest } from '../support/factories/core-campaigns.ts';
import { memberListItem } from '../support/factories/core-members.ts';
import type { ApiMock } from '../support/api-mock.ts';
import { cellOf, dialog, expectEmptyTable, tableRows, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const requestsTable = (page: Page) => page.getByRole('table');
const loadMore = (page: Page) => page.getByRole('button', { name: 'Load more join requests' });
const search = (page: Page) => page.getByLabel('Search');

const asking = (id: number, first: string, last: string, overrides: Partial<JoinRequest> = {}): JoinRequest => joinRequest({
    id, body_id: 1, user: memberListItem({ id: id + 100, first_name: first, last_name: last }), ...overrides
});

const JANE = asking(61, 'Jane', 'Doe', { motivation: 'I study in this city', created_at: '2027-02-10T09:30:00.000Z' });
const JOHN = asking(62, 'John', 'Roe', { status: 'approved' });

const answer = (api: ApiMock, requests: JoinRequest[] = [JANE, JOHN]): void => {
    api.json('GET core /bodies/:id/join-requests', okList(requests));
};

// 30 requests: a full page, so the list offers to load more.
const fullPage = () => Array.from({ length: 30 }, (_, index) => asking(200 + index, 'Member', `Number ${index}`));

test.describe('the join requests of a body', () => {
    test('lists every request, with the actions on the pending ones', async ({ page, api }) => {
        answer(api);

        await page.goto('/bodies/1/join_requests');

        await expect(page).toHaveTitle('MyAEGEE | View join requests of a body');
        await expect(page.getByRole('heading', { name: 'Join requests', exact: true })).toBeVisible();
        const table = requestsTable(page);
        await expect(tableRows(table)).toHaveCount(2);
        const jane = tableRows(table).filter({ hasText: 'Jane Doe' });
        await expect(jane.getByRole('link', { name: 'Jane Doe' })).toHaveAttribute('href', '/members/161');
        await expect(await cellOf(table, jane, 'Motivation')).toHaveText('I study in this city');
        // 09:30 UTC is 10:30 in Brussels in winter.
        await expect(await cellOf(table, jane, 'Date')).toHaveText('2027-02-10 10:30');
        await expect(jane.getByRole('button', { name: 'Approve' })).toBeVisible();
        await expect(jane.getByRole('button', { name: 'Reject' })).toBeVisible();
        const john = tableRows(table).filter({ hasText: 'John Roe' });
        await expect(john.getByRole('button')).toHaveCount(0);
        await expect(loadMore(page)).toBeHidden();

        const [list] = api.callsTo('GET core /bodies/:id/join-requests');
        expect(list.params).toEqual({ id: '1' });
        expect(Object.fromEntries(list.query)).toEqual({ limit: '30', offset: '0' });
    });

    test('shows only the pending requests, and all of them again', async ({ page, api }) => {
        api.on('GET core /bodies/:id/join-requests', ({ query }) => ({ json: okList(query.get('status') === 'pending' ? [JANE] : [JANE, JOHN]) }));

        await page.goto('/bodies/1/join_requests');
        const table = requestsTable(page);
        await expect(tableRows(table)).toHaveCount(2);
        await page.getByRole('button', { name: 'Display only pending join requests' }).click();

        await expect(tableRows(table)).toHaveCount(1);
        expect(Object.fromEntries(api.callsTo('GET core /bodies/:id/join-requests').at(-1)!.query)).toEqual({ limit: '30', offset: '0', status: 'pending' });
        await page.getByRole('button', { name: 'Display all join requests' }).click();

        await expect(tableRows(table)).toHaveCount(2);
        await expect.poll(() => api.callsTo('GET core /bodies/:id/join-requests').at(-1)!.query.has('status')).toBe(false);
        await expect(page.getByRole('button', { name: 'Display only pending join requests' })).toBeVisible();
    });

    test('searching asks again with the text', async ({ page, api }) => {
        // Slow answers, so each keystroke cancels the request of the one before.
        api.on('GET core /bodies/:id/join-requests', ({ query }) => ({ json: okList(query.get('query') === 'jan' ? [JANE] : [JANE, JOHN]), delayMs: 500 }));

        await page.goto('/bodies/1/join_requests');
        const table = requestsTable(page);
        await expect(tableRows(table)).toHaveCount(2);
        await search(page).pressSequentially('jan', { delay: 100 });

        await expect(tableRows(table)).toHaveCount(1);
        expect(Object.fromEntries(api.callsTo('GET core /bodies/:id/join-requests').at(-1)!.query)).toEqual({ limit: '30', offset: '0', query: 'jan' });
        // Each keystroke cancels the request before it: no error for those. Counted at once, as a
        // toast that was shown is gone again after three seconds.
        expect(await toast(page, 'Could not fetch join requests').count()).toBe(0);
    });

    test('approving a request asks first and keeps it without its actions', async ({ page, api }) => {
        answer(api);
        api.json('PUT core /bodies/:id/join-requests/:request_id/status', { success: true, message: 'Successfully approved.' });

        await page.goto('/bodies/1/join_requests');
        const jane = tableRows(requestsTable(page)).filter({ hasText: 'Jane Doe' });
        await jane.getByRole('button', { name: 'Approve' }).click();
        const confirm = dialog(page, 'Approve Jane Doe');
        await expect(confirm).toContainText('Are you sure you want to approve Jane Doe?');
        await confirm.getByRole('button', { name: 'Approve Jane Doe' }).click();

        await expect(toast(page, 'Join request is approved.')).toBeVisible();
        await expect(jane).toBeVisible();
        await expect(jane.getByRole('button')).toHaveCount(0);
        await expect.poll(() => api.callsTo('PUT core /bodies/:id/join-requests/:request_id/status').map((call) => [call.params, call.body]))
            .toEqual([[{ id: '1', request_id: '61' }, { status: 'approved' }]]);
    });

    test('rejecting a request asks first and removes it', async ({ page, api }) => {
        answer(api);
        api.json('PUT core /bodies/:id/join-requests/:request_id/status', { success: true, message: 'Successfully rejected.' });

        await page.goto('/bodies/1/join_requests');
        const table = requestsTable(page);
        await tableRows(table).filter({ hasText: 'Jane Doe' }).getByRole('button', { name: 'Reject' }).click();
        const confirm = dialog(page, 'Reject Jane Doe');
        await expect(confirm).toContainText('Are you sure you want to reject Jane Doe?');
        await confirm.getByRole('button', { name: 'Reject Jane Doe' }).click();

        await expect(toast(page, 'Join request is rejected.')).toBeVisible();
        await expect(tableRows(table)).toHaveCount(1);
        await expect(tableRows(table).filter({ hasText: 'Jane Doe' })).toHaveCount(0);
        await expect.poll(() => api.callsTo('PUT core /bodies/:id/join-requests/:request_id/status').map((call) => [call.params, call.body]))
            .toEqual([[{ id: '1', request_id: '61' }, { status: 'rejected' }]]);
    });

    test('cancelling sends nothing, and a name is shown as it was written', async ({ page, api }) => {
        answer(api, [asking(63, 'Ann <b>Bold</b>', 'Doe')]);

        await page.goto('/bodies/1/join_requests');
        await tableRows(requestsTable(page)).first().getByRole('button', { name: 'Approve' }).click();
        const confirm = dialog(page, 'Approve Ann <b>Bold</b> Doe');
        await expect(confirm).toContainText('Are you sure you want to approve Ann <b>Bold</b> Doe?');
        await confirm.getByRole('button', { name: 'Cancel' }).click();

        await expect(confirm).toBeHidden();
        expect(api.callsTo('PUT core /bodies/:id/join-requests/:request_id/status')).toHaveLength(0);
    });

    test('a refused change says why', async ({ page, api }) => {
        answer(api);
        api.on('PUT core /bodies/:id/join-requests/:request_id/status', { status: 400, json: badRequest('The join request was processed already.') });

        await page.goto('/bodies/1/join_requests');
        const jane = tableRows(requestsTable(page)).filter({ hasText: 'Jane Doe' });
        await jane.getByRole('button', { name: 'Approve' }).click();
        await dialog(page, 'Approve Jane Doe').getByRole('button', { name: 'Approve Jane Doe' }).click();

        await expect(toast(page, 'Could not process join request: The join request was processed already.')).toBeVisible();
        await expect(jane.getByRole('button', { name: 'Approve' })).toBeVisible();
    });

    test('an approval whose mail could not be sent keeps the request', async ({ page, api }) => {
        answer(api);
        api.on('PUT core /bodies/:id/join-requests/:request_id/status', { status: 503, json: { success: false, message: 'The mail could not be sent, so nothing was saved. Please try again later.' } });

        await page.goto('/bodies/1/join_requests');
        const jane = tableRows(requestsTable(page)).filter({ hasText: 'Jane Doe' });
        await jane.getByRole('button', { name: 'Approve' }).click();
        await dialog(page, 'Approve Jane Doe').getByRole('button', { name: 'Approve Jane Doe' }).click();

        await expect(toast(page, 'Could not process join request: The mail could not be sent, so nothing was saved. Please try again later.')).toBeVisible();
        await expect(jane.getByRole('button', { name: 'Approve' })).toBeVisible();
        await expect.poll(() => api.callsTo('PUT core /bodies/:id/join-requests/:request_id/status').map((call) => call.body)).toEqual([{ status: 'approved' }]);
    });

    test('a full page offers more requests and appends them', async ({ page, api }) => {
        api.on('GET core /bodies/:id/join-requests', ({ query }) => ({ json: okList(query.get('offset') === '0' ? fullPage() : [JANE], 31) }));

        await page.goto('/bodies/1/join_requests');
        const table = requestsTable(page);
        await expect(tableRows(table)).toHaveCount(30);
        await loadMore(page).click();

        await expect(tableRows(table)).toHaveCount(31);
        await expect(tableRows(table).filter({ hasText: 'Jane Doe' })).toBeVisible();
        expect(Object.fromEntries(api.callsTo('GET core /bodies/:id/join-requests').at(-1)!.query)).toEqual({ limit: '30', offset: '30' });
        await expect(loadMore(page)).toBeHidden();
    });

    test('loading more is disabled while the list loads', async ({ page, api }) => {
        api.on('GET core /bodies/:id/join-requests', ({ query }) => (query.get('offset') === '0'
            ? { json: okList(fullPage(), 31) }
            : { json: okList([], 31), delayMs: 1500 }));

        await page.goto('/bodies/1/join_requests');
        await expect(tableRows(requestsTable(page))).toHaveCount(30);
        await loadMore(page).click();

        await expect(loadMore(page)).toBeDisabled();
        await expect(loadMore(page)).toBeHidden();
    });

    test('says so when nobody asked to join', async ({ page, api }) => {
        answer(api, []);

        await page.goto('/bodies/1/join_requests');

        await expect.poll(() => api.callsTo('GET core /bodies/:id/join-requests').length).toBe(1);
        await expectEmptyTable(requestsTable(page));
    });

    test('a failing list says why and can be tried again', async ({ page, api }) => {
        api.on('GET core /bodies/:id/join-requests', { status: 403, json: forbidden('Permission view:join_request is required, but not present.') });

        await page.goto('/bodies/1/join_requests');

        await expect(toast(page, 'Could not fetch join requests: Permission view:join_request is required, but not present.')).toBeVisible();
        await expect(loadMore(page)).toBeEnabled();
    });
});
