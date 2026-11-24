// Members of a body (/bodies/:id/members): the list, searching it, comments, removing members
// and adding existing members. The fee payment dialogs are in bodies-view-members-payments.spec.ts.
import type { Page } from '@playwright/test';

import { forbidden, notFound, ok, validationError } from '../support/factories/base.ts';
import { bodyMembership, memberSearchResult, type BodyMembership } from '../support/factories/core.ts';
import { bodyDetail } from '../support/factories/core-bodies.ts';
import type { ApiMock } from '../support/api-mock.ts';
import { cellOf, dialog, expectEmptyTable, permissionsFor, tableRows, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

// A membership of body 1 for a person with this name.
const membership = (first: string, last: string, overrides: Partial<BodyMembership> = {}): BodyMembership => {
    const made = bodyMembership({ body_id: 1, ...overrides });
    return { ...made, user: { ...made.user, first_name: first, last_name: last } };
};

const membersTable = (page: Page) => page.getByRole('region', { name: 'Members of the body' }).getByRole('table');

const answer = (api: ApiMock, members: BodyMembership[], permissions: string[] = []): void => {
    api.json('GET core /bodies/:id', ok(bodyDetail({ id: 1, pays_fees: false })));
    api.json('GET core /bodies/:id/members', ok(members));
    permissionsFor(api, 'bodies', 1, permissions);
};

test.describe('members of a body', () => {
    test('lists the members by first name, with links for those who may see members', async ({ page, api }) => {
        answer(api, [membership('Zoe', 'Zed', { user_id: 31 }), membership('Ann', 'Able', { user_id: 32, comment: 'Treasurer' }), membership('Bob', 'Bee', { user_id: 33 })], ['global:view:member']);

        await page.goto('/bodies/1/members');

        await expect(page.getByRole('heading', { name: 'Members', exact: true })).toBeVisible();
        await expect(page).toHaveTitle('MyAEGEE | View members of a body');
        await expect(page.getByText('Total members: 3')).toBeVisible();
        const table = membersTable(page);
        await expect(tableRows(table)).toHaveCount(3);
        await expect(tableRows(table).nth(0)).toContainText('Ann Able');
        await expect(tableRows(table).nth(1)).toContainText('Bob Bee');
        await expect(tableRows(table).nth(2)).toContainText('Zoe Zed');
        await expect(table.getByRole('link', { name: 'Ann Able' })).toHaveAttribute('href', '/members/32');
        await expect(await cellOf(table, tableRows(table).nth(0), 'Comment')).toHaveText('Treasurer');
        await expect(page.getByRole('region', { name: 'Members of the body' })).toHaveAttribute('aria-busy', 'false');

        expect(api.callsTo('GET core /bodies/:id')[0].params).toEqual({ id: '1' });
        expect([...api.callsTo('GET core /bodies/:id/members')[0].query.keys()]).toEqual([]);
        expect(api.callsTo('GET core /bodies/:id/my_permissions')).toHaveLength(1);
    });

    test('without rights the names are plain text and there is nothing to change', async ({ page, api }) => {
        answer(api, [membership('Ann', 'Able')]);

        await page.goto('/bodies/1/members');

        const table = membersTable(page);
        await expect(tableRows(table)).toHaveCount(1);
        await expect(tableRows(table).first()).toContainText('Ann Able');
        await expect(table.getByRole('link')).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Add member' })).toHaveCount(0);
        await expect(page.getByRole('link', { name: 'Create member' })).toHaveCount(0);
        await expect(page.getByRole('link', { name: 'Bulk import members' })).toHaveCount(0);
        for (const name of ['Edit', 'Delete', 'View or manage payments', 'Add fee payment']) {
            await expect(table.getByRole('button', { name }), name).toHaveCount(0);
        }
        await expect(table.getByText('Last payment exp. date')).toHaveCount(0);
    });

    test('those who may add and create members get the buttons for it', async ({ page, api }) => {
        // Today's check and the service's both accept this set.
        answer(api, [], ['global:create:member', 'local:add_member:body', 'local:create_member:body']);

        await page.goto('/bodies/1/members');

        await expect(page.getByRole('button', { name: 'Add member' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Create member' })).toHaveAttribute('href', '/bodies/1/new_member');
        await expect(page.getByRole('link', { name: 'Bulk import members' })).toHaveAttribute('href', '/bodies/1/bulk_import');
    });

    test('searching asks again for the body, its members and the permissions', async ({ page, api }) => {
        api.json('GET core /bodies/:id', ok(bodyDetail({ id: 1, pays_fees: false })));
        api.on('GET core /bodies/:id/members', ({ query }) => ({
            json: ok(query.get('query') === 'Bo' ? [membership('Bob', 'Bee')] : [membership('Ann', 'Able'), membership('Bob', 'Bee')])
        }));
        permissionsFor(api, 'bodies', 1, []);

        await page.goto('/bodies/1/members');
        const table = membersTable(page);
        await expect(tableRows(table)).toHaveCount(2);
        await page.getByRole('textbox', { name: 'Search' }).pressSequentially('Bo');

        await expect(page.getByText('Total members: 1')).toBeVisible();
        await expect(tableRows(table)).toHaveCount(1);
        expect(api.callsTo('GET core /bodies/:id/members').at(-1)!.query.get('query')).toBe('Bo');
        await expect.poll(() => api.callsTo('GET core /bodies/:id').length).toBeGreaterThanOrEqual(2);
        await expect.poll(() => api.callsTo('GET core /bodies/:id/my_permissions').length).toBeGreaterThanOrEqual(2);
        await expect(toast(page, 'Could not fetch members')).toHaveCount(0);
    });

    test('a long list is split into pages', async ({ page, api }) => {
        const names = Array.from({ length: 25 }, (_, index) => `Person${String(index + 1).padStart(2, '0')}`);
        answer(api, names.map((name) => membership(name, 'Member')));

        await page.goto('/bodies/1/members');

        const table = membersTable(page);
        await expect(page.getByText('Total members: 25')).toBeVisible();
        await expect(tableRows(table)).toHaveCount(20);
        await page.getByRole('button', { name: 'Next page' }).click();
        await expect(tableRows(table)).toHaveCount(5);
        await expect(tableRows(table).first()).toContainText('Person21 Member');
        await page.getByRole('button', { name: /^Page 1/ }).filter({ hasText: /^1$/ }).click();
        await expect(tableRows(table).first()).toContainText('Person01 Member');
    });

    test('says so when the body has no members', async ({ page, api }) => {
        answer(api, []);

        await page.goto('/bodies/1/members');

        await expect.poll(() => api.callsTo('GET core /bodies/:id/my_permissions').length).toBe(1);
        await expectEmptyTable(membersTable(page));
        await expect(page.getByText('Total members: 0')).toBeVisible();
    });

    test('says why the members could not be loaded and stops loading', async ({ page, api }) => {
        api.json('GET core /bodies/:id', ok(bodyDetail({ id: 1 })));
        api.on('GET core /bodies/:id/members', { status: 403, json: forbidden('Permission view_members:body is required, but not present.') });

        await page.goto('/bodies/1/members');

        await expect(toast(page, 'Could not fetch members: Permission view_members:body is required, but not present.')).toBeVisible();
        await expect(page.getByRole('region', { name: 'Members of the body' })).toHaveAttribute('aria-busy', 'false');
    });

    test('removes a member after asking', async ({ page, api }) => {
        const bold = membership('Ann', '<b>Bold</b>', { id: 71 });
        answer(api, [bold, membership('Bob', 'Bee', { id: 72 })], ['local:delete_member:body']);
        api.json('DELETE core /bodies/:id/members/:membership_id', ok({}));

        await page.goto('/bodies/1/members');
        const table = membersTable(page);
        const row = tableRows(table).filter({ hasText: 'Ann <b>Bold</b>' });
        await row.getByRole('button', { name: 'Delete' }).click();

        const confirm = dialog(page, 'Deleting a member');
        await expect(confirm).toContainText('Are you sure you want to delete Ann <b>Bold</b> from this body? This action cannot be undone.');
        await confirm.getByRole('button', { name: 'Cancel' }).click();
        await expect(confirm).toBeHidden();
        expect(api.callsTo('DELETE core /bodies/:id/members/:membership_id')).toHaveLength(0);

        await row.getByRole('button', { name: 'Delete' }).click();
        await dialog(page, 'Deleting a member').getByRole('button', { name: 'Delete member' }).click();

        await expect(toast(page, 'Member is deleted.')).toBeVisible();
        await expect(tableRows(table)).toHaveCount(1);
        await expect(tableRows(table).first()).toContainText('Bob Bee');
        expect(api.callsTo('DELETE core /bodies/:id/members/:membership_id').map((call) => call.params)).toEqual([{ id: '1', membership_id: '71' }]);
    });

    test('keeps the member when removing fails', async ({ page, api }) => {
        answer(api, [membership('Ann', 'Able')], ['local:delete_member:body']);
        api.on('DELETE core /bodies/:id/members/:membership_id', { status: 403, json: forbidden('Permission delete_member:body is required, but not present.') });

        await page.goto('/bodies/1/members');
        await tableRows(membersTable(page)).first().getByRole('button', { name: 'Delete' }).click();
        await dialog(page, 'Deleting a member').getByRole('button', { name: 'Delete member' }).click();

        await expect(toast(page, 'Could not delete member: Permission delete_member:body is required, but not present.')).toBeVisible();
        await expect(tableRows(membersTable(page))).toHaveCount(1);
    });

    test('changes the comment of a member', async ({ page, api }) => {
        answer(api, [membership('Ann', 'Able', { id: 71, comment: 'New member' })], ['local:update_member:body']);
        api.json('PUT core /bodies/:id/members/:membership_id', ok({}));

        await page.goto('/bodies/1/members');
        const table = membersTable(page);
        const row = tableRows(table).first();
        await row.getByRole('button', { name: 'Edit' }).click();

        const prompt = dialog(page, 'Change comment');
        await expect(prompt).toContainText('The comment on Ann Able in this body. Leave it empty to remove it.');
        await expect(prompt.getByRole('textbox')).toHaveValue('New member');
        await prompt.getByRole('button', { name: 'Cancel' }).click();
        await expect(prompt).toBeHidden();

        await row.getByRole('button', { name: 'Edit' }).click();
        await dialog(page, 'Change comment').getByRole('textbox').fill('Treasurer');
        await dialog(page, 'Change comment').getByRole('button', { name: 'Save comment' }).click();

        await expect(toast(page, 'Comment is set.')).toBeVisible();
        await expect(await cellOf(table, row, 'Comment')).toHaveText('Treasurer');
        expect(api.callsTo('PUT core /bodies/:id/members/:membership_id').map((call) => [call.params, call.body]))
            .toEqual([[{ id: '1', membership_id: '71' }, { comment: 'Treasurer' }]]);
    });

    test('a comment can be removed', async ({ page, api }) => {
        answer(api, [membership('Ann', 'Able', { id: 71, comment: 'New member' })], ['local:update_member:body']);
        api.json('PUT core /bodies/:id/members/:membership_id', ok({}));

        await page.goto('/bodies/1/members');
        const row = tableRows(membersTable(page)).first();
        await row.getByRole('button', { name: 'Edit' }).click();
        await dialog(page, 'Change comment').getByRole('textbox').fill('');
        await dialog(page, 'Change comment').getByRole('button', { name: 'Save comment' }).click();

        await expect(toast(page, 'Comment is set.')).toBeVisible();
        await expect(await cellOf(membersTable(page), row, 'Comment')).toHaveText('');
        expect(api.callsTo('PUT core /bodies/:id/members/:membership_id').map((call) => call.body)).toEqual([{ comment: '' }]);
    });

    test('says why a comment could not be changed', async ({ page, api }) => {
        answer(api, [membership('Ann', 'Able', { comment: 'New member' })], ['local:update_member:body']);
        api.on('PUT core /bodies/:id/members/:membership_id', { status: 500, json: { success: false, message: 'Database is down' } });

        await page.goto('/bodies/1/members');
        const row = tableRows(membersTable(page)).first();
        await row.getByRole('button', { name: 'Edit' }).click();
        await dialog(page, 'Change comment').getByRole('textbox').fill('Treasurer');
        await dialog(page, 'Change comment').getByRole('button', { name: 'Save comment' }).click();

        await expect(toast(page, 'Error updating user comment: Database is down')).toBeVisible();
        await expect(await cellOf(membersTable(page), row, 'Comment')).toHaveText('New member');
    });
});

test.describe('members of a body for a visitor', () => {
    test.use({ session: 'anonymous' });

    test('sends the visitor to the login page first', async ({ page }) => {
        await page.goto('/bodies/1/members');

        await expect(page).toHaveURL('/login?to=%2Fbodies%2F1%2Fmembers');
    });
});

test.describe('adding an existing member to a body', () => {
    const creating = ['global:create:member', 'local:add_member:body', 'local:create_member:body'];

    test('finds the person and adds them', async ({ page, api }) => {
        answer(api, [], creating);
        api.on('GET core /members_search', ({ query }) => ({
            json: ok(query.get('query') === 'jan' ? [memberSearchResult({ id: 55, first_name: 'Jane', last_name: 'Doe' })] : [])
        }));
        api.json('POST core /bodies/:id/members', ok({ id: 90, user_id: 55, body_id: 1 }));

        await page.goto('/bodies/1/members');
        await page.getByRole('button', { name: 'Add member' }).click();
        const modal = dialog(page, 'Add member');
        await modal.getByRole('textbox', { name: 'Search by name or email' }).fill('jan');
        await modal.getByRole('button', { name: 'Jane Doe' }).click();

        // The page is loaded again to show the new member.
        await expect.poll(() => api.callsTo('GET core /bodies/:id').length).toBe(2);
        expect(api.callsTo('POST core /bodies/:id/members').map((call) => [call.params, call.body])).toEqual([[{ id: '1' }, { user_id: 55 }]]);
        expect(api.callsTo('GET core /members_search').map((call) => call.query.get('query'))).toEqual(['jan']);
    });

    test('closes without adding anyone', async ({ page, api }) => {
        answer(api, [], creating);

        await page.goto('/bodies/1/members');
        await page.getByRole('button', { name: 'Add member' }).click();
        await dialog(page, 'Add member').getByRole('button', { name: 'Cancel' }).click();
        await expect(dialog(page, 'Add member')).toBeHidden();

        await page.getByRole('button', { name: 'Add member' }).click();
        await dialog(page, 'Add member').getByRole('button', { name: 'close' }).click();
        await expect(dialog(page, 'Add member')).toBeHidden();
        expect(api.callsTo('POST core /bodies/:id/members')).toHaveLength(0);
        expect(api.callsTo('GET core /members_search')).toHaveLength(0);
    });

    test('says when the person is a member already', async ({ page, api }) => {
        answer(api, [], creating);
        api.json('GET core /members_search', ok([memberSearchResult({ id: 55, first_name: 'Jane', last_name: 'Doe' })]));
        api.on('POST core /bodies/:id/members', { status: 422, json: validationError({ user_id: ['This user is already a member of this body.'] }) });

        await page.goto('/bodies/1/members');
        await page.getByRole('button', { name: 'Add member' }).click();
        await dialog(page, 'Add member').getByRole('textbox', { name: 'Search by name or email' }).fill('jan');
        await dialog(page, 'Add member').getByRole('button', { name: 'Jane Doe' }).click();

        await expect(toast(page, 'Could not add member: this person is already a member of this body.')).toBeVisible();
    });

    test('says why the person could not be added', async ({ page, api }) => {
        answer(api, [], creating);
        api.json('GET core /members_search', ok([memberSearchResult({ id: 55, first_name: 'Jane', last_name: 'Doe' })]));
        api.on('POST core /bodies/:id/members', { status: 404, json: notFound('User is not found') });

        await page.goto('/bodies/1/members');
        await page.getByRole('button', { name: 'Add member' }).click();
        await dialog(page, 'Add member').getByRole('textbox', { name: 'Search by name or email' }).fill('jan');
        await dialog(page, 'Add member').getByRole('button', { name: 'Jane Doe' }).click();

        await expect(toast(page, 'Could not add member: User is not found')).toBeVisible();
    });

    test('says so when the welcome mail could not be sent and nobody was added', async ({ page, api }) => {
        answer(api, [], creating);
        api.json('GET core /members_search', ok([memberSearchResult({ id: 55, first_name: 'Jane', last_name: 'Doe' })]));
        api.on('POST core /bodies/:id/members', { status: 503, json: { success: false, message: 'The mail could not be sent, so nothing was saved. Please try again later.' } });

        await page.goto('/bodies/1/members');
        await page.getByRole('button', { name: 'Add member' }).click();
        await dialog(page, 'Add member').getByRole('textbox', { name: 'Search by name or email' }).fill('jan');
        await dialog(page, 'Add member').getByRole('button', { name: 'Jane Doe' }).click();

        await expect(toast(page, 'Could not add member: The mail could not be sent, so nothing was saved. Please try again later.')).toBeVisible();
        expect(api.callsTo('POST core /bodies/:id/members').map((call) => call.body)).toEqual([{ user_id: 55 }]);
    });

    test('says why the search failed', async ({ page, api }) => {
        answer(api, [], creating);
        api.on('GET core /members_search', { status: 403, json: forbidden('Permission global:search:member is required to search without body_id.') });

        await page.goto('/bodies/1/members');
        await page.getByRole('button', { name: 'Add member' }).click();
        // Each letter searches again and cancels the search before it, without an error.
        await dialog(page, 'Add member').getByRole('textbox', { name: 'Search by name or email' }).pressSequentially('jan');

        await expect(toast(page, 'Could not fetch members: Permission global:search:member is required to search without body_id.').first()).toBeVisible();
    });
});
