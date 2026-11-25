// The boards of a body (/bodies/:id/boards), and editing or deleting one in the board dialog.
// Adding a board from the body page is in bodies-single.spec.ts.
import type { Page } from '@playwright/test';

import { forbidden, notFound, ok } from '../support/factories/base.ts';
import { bodyMembership, type BodyMembership } from '../support/factories/core.ts';
import { board, type Board } from '../support/factories/network.ts';
import type { ApiMock } from '../support/api-mock.ts';
import { dialog, permissionsFor, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const membership = (id: number, first: string, last: string): BodyMembership => {
    const made = bodyMembership({ body_id: 1, user_id: id });
    return { ...made, user: { ...made.user, first_name: first, last_name: last } };
};

const MEMBERS = [membership(41, 'Pia', 'President'), membership(42, 'Sam', 'Secretary'), membership(43, 'Tom', 'Treasurer'), membership(44, 'Val', 'Vice')];

const current = (): Board => board({
    id: 81,
    body_id: 1,
    name: 'Board 2027',
    elected_date: '2026-12-01',
    start_date: '2027-01-01',
    end_date: '2027-12-31',
    president: 41,
    secretary: 42,
    treasurer: 43,
    other_members: [{ user_id: 44, function: 'Vice-president' }],
    message: 'We are the new board'
});
const previous = (): Board => board({
    id: 80, body_id: 1, name: null, elected_date: '2025-12-01', start_date: '2026-01-01', end_date: '2026-12-31', president: 41, secretary: 41, treasurer: 41, other_members: []
});

const answer = (api: ApiMock, { boards = [current(), previous()], permissions = [] as string[] } = {}): void => {
    api.json('GET network /bodies/:id/boards', ok(boards));
    api.json('GET core /bodies/:id/members', ok(MEMBERS));
    permissionsFor(api, 'bodies', 1, permissions);
};

const boardCard = (page: Page, header: string | RegExp) => page.getByRole('button', { name: header });

test.describe('the boards of a body', () => {
    test('lists the boards, newest first, and opens one to show its people', async ({ page, api }) => {
        answer(api);

        await page.goto('/bodies/1/boards');

        await expect(page.getByRole('heading', { name: 'Boards', exact: true })).toBeVisible();
        await expect(page).toHaveTitle('MyAEGEE | View boards of a body');
        const newest = boardCard(page, 'Board 2027 (2027-01-01 - 2027-12-31)');
        await expect(newest).toBeVisible();
        await expect(boardCard(page, '2026-01-01 - 2026-12-31')).toBeVisible();
        await expect(page.getByRole('cell', { name: 'Pia President' }).first()).toBeHidden();

        await newest.click();

        const people = page.getByRole('table').first();
        const row = (name: string) => people.getByRole('row').filter({ has: page.getByRole('rowheader', { name, exact: true }) });
        await expect(row('President')).toContainText('Pia President');
        await expect(row('Secretary')).toContainText('Sam Secretary');
        await expect(row('Treasurer')).toContainText('Tom Treasurer');
        await expect(row('Vice-president')).toContainText('Val Vice');
        await expect(page.getByRole('button', { name: 'Add board' })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Edit board' })).toHaveCount(0);

        const [list] = api.callsTo('GET network /bodies/:id/boards');
        expect(list.params).toEqual({ id: '1' });
        expect(Object.fromEntries(list.query)).toEqual({ sort: 'start_date', direction: 'desc' });
        await expect.poll(() => api.callsTo('GET core /bodies/:id/members')[0].params).toEqual({ id: '1' });
    });

    test('shows an open-ended term', async ({ page, api }) => {
        answer(api, { boards: [board({ body_id: 1, name: null, start_date: '2027-01-01', end_date: null, president: 41, secretary: 42, treasurer: 43 })] });

        await page.goto('/bodies/1/boards');

        await expect(boardCard(page, /^2027-01-01 -\s*$/)).toBeVisible();
    });

    test('says why the boards could not be loaded', async ({ page, api }) => {
        api.on('GET network /bodies/:id/boards', { status: 500, json: { success: false, message: 'Network is down' } });
        permissionsFor(api, 'bodies', 1, []);

        await page.goto('/bodies/1/boards');

        await expect(toast(page, 'Could not fetch boards: Network is down')).toBeVisible();
        await expect(page.getByText('Nothing here.')).toBeVisible();
    });

    test('says why the people of the boards could not be loaded', async ({ page, api }) => {
        api.json('GET network /bodies/:id/boards', ok([current()]));
        api.on('GET core /bodies/:id/members', { status: 403, json: forbidden('Permission view_members:body is required, but not present.') });
        permissionsFor(api, 'bodies', 1, []);

        await page.goto('/bodies/1/boards');

        await expect(toast(page, 'Could not fetch boards: Permission view_members:body is required, but not present.')).toBeVisible();
        await expect(boardCard(page, 'Board 2027 (2027-01-01 - 2027-12-31)')).toBeVisible();
    });

    for (const permission of ['local:manage_network:boards', 'global:manage_network:boards']) {
        test(`those with ${permission} may add and edit boards`, async ({ page, api }) => {
            answer(api, { permissions: [permission] });

            await page.goto('/bodies/1/boards');
            await expect(page.getByRole('button', { name: 'Add board' })).toBeVisible();
            await boardCard(page, 'Board 2027 (2027-01-01 - 2027-12-31)').click();

            await expect(page.getByRole('button', { name: 'Edit board' }).first()).toBeVisible();
        });
    }

    test('the dialog to add a board opens and closes without saving', async ({ page, api }) => {
        answer(api, { permissions: ['global:manage_network:boards'] });

        await page.goto('/bodies/1/boards');
        await page.getByRole('button', { name: 'Add board' }).click();
        const modal = dialog(page, 'Add board');
        await expect(modal.getByText('Please make sure that your contact details are (still) correct.')).toBeVisible();
        await modal.getByRole('button', { name: 'Cancel' }).click();

        await expect(modal).toBeHidden();
        expect(api.callsTo('* network *').filter((call) => call.method !== 'GET')).toHaveLength(0);
    });
});

test.describe('editing a board', () => {
    const openEdit = async (page: Page): Promise<void> => {
        await page.goto('/bodies/1/boards');
        await boardCard(page, 'Board 2027 (2027-01-01 - 2027-12-31)').click();
        await page.getByRole('button', { name: 'Edit board' }).first().click();
    };

    test('starts from the board as it is and saves the changes', async ({ page, api }) => {
        answer(api, { boards: [board({ ...current(), other_members: [] })], permissions: ['global:manage_network:boards'] });
        api.json('PUT core /bodies/:id', ok({}));
        api.json('PUT network /bodies/:id/boards/:board_id', ok({}));

        await openEdit(page);
        const modal = dialog(page, 'Edit board');
        await expect(modal.getByLabel('Board election date')).toHaveValue('2026-12-01');
        await expect(modal.getByLabel('Term start date')).toHaveValue('2027-01-01');
        await expect(modal.getByLabel('Term end date')).toHaveValue('2027-12-31');
        await expect(modal.getByLabel('Board name')).toHaveValue('Board 2027');
        await expect(modal.getByRole('group', { name: 'President' }).getByRole('textbox')).toHaveValue('Pia President');
        await expect(modal.getByRole('group', { name: 'Treasurer' }).getByRole('textbox')).toHaveValue('Tom Treasurer');
        await expect(modal.getByRole('textbox', { name: 'Message' })).toHaveValue('We are the new board');
        await expect(modal.getByText('Please make sure that your contact details are (still) correct.')).toHaveCount(0);

        await modal.getByLabel('Board name').fill('Board 2027/28');
        await modal.getByRole('button', { name: 'Save changes' }).click();

        await expect.poll(() => api.callsTo('GET network /bodies/:id/boards').length).toBe(2);
        const [put] = api.callsTo('PUT network /bodies/:id/boards/:board_id');
        expect(put.params).toEqual({ id: '1', board_id: '81' });
        expect(put.body).toMatchObject({
            elected_date: '2026-12-01',
            start_date: '2027-01-01',
            end_date: '2027-12-31',
            president: 41,
            secretary: 42,
            treasurer: 43,
            other_members: [],
            name: 'Board 2027/28',
            message: 'We are the new board'
        });
    });

    test('deletes a board after asking', async ({ page, api }) => {
        answer(api, { permissions: ['global:manage_network:boards'] });
        api.json('DELETE network /bodies/:id/boards/:board_id', ok({}));

        await openEdit(page);
        await dialog(page, 'Edit board').getByRole('button', { name: 'Delete board' }).click();
        const confirm = dialog(page, 'Deleting a board');
        await expect(confirm).toContainText('Are you sure you want to delete the board Board 2027 (2027-01-01 - 2027-12-31)? This action cannot be undone.');
        await confirm.getByRole('button', { name: 'Cancel' }).click();
        await expect(confirm).toBeHidden();
        expect(api.callsTo('DELETE network /bodies/:id/boards/:board_id')).toHaveLength(0);

        await dialog(page, 'Edit board').getByRole('button', { name: 'Delete board' }).click();
        await dialog(page, 'Deleting a board').getByRole('button', { name: 'Delete board' }).click();

        await expect.poll(() => api.callsTo('GET network /bodies/:id/boards').length).toBe(2);
        await expect.poll(() => api.callsTo('DELETE network /bodies/:id/boards/:board_id').map((call) => call.params)).toEqual([{ id: '1', board_id: '81' }]);
    });

    test('a manager of the body\'s boards edits a board but is not offered to delete it', async ({ page, api }) => {
        // Deleting a board needs global:manage_network:boards; network refuses it to everyone else.
        answer(api, { permissions: ['local:manage_network:boards'] });

        await openEdit(page);

        const modal = dialog(page, 'Edit board');
        await expect(modal.getByRole('button', { name: 'Save changes' })).toBeVisible();
        expect(await modal.getByRole('button', { name: 'Delete board' }).count()).toBe(0);
    });

    test('says why a board could not be deleted', async ({ page, api }) => {
        // The board was deleted in the meantime, from another tab or by someone else.
        answer(api, { boards: [board({ ...current(), name: null, end_date: null })], permissions: ['global:manage_network:boards'] });
        api.on('DELETE network /bodies/:id/boards/:board_id', { status: 404, json: notFound('The board is not found.') });

        await page.goto('/bodies/1/boards');
        await boardCard(page, /^2027-01-01 -\s*$/).click();
        await page.getByRole('button', { name: 'Edit board' }).click();
        await dialog(page, 'Edit board').getByRole('button', { name: 'Delete board' }).click();
        // A board without a name or end is named by the start of its term.
        await expect(dialog(page, 'Deleting a board')).toContainText('Are you sure you want to delete the board 2027-01-01 - ? This action cannot be undone.');
        await dialog(page, 'Deleting a board').getByRole('button', { name: 'Delete board' }).click();

        await expect(toast(page, 'Could not delete board: The board is not found.')).toBeVisible();
        await expect(dialog(page, 'Edit board')).toBeVisible();
    });
});

test.describe('the boards of a body for a visitor', () => {
    test.use({ session: 'anonymous' });

    test('sends the visitor to the login page first', async ({ page }) => {
        await page.goto('/bodies/1/boards');

        await expect(page).toHaveURL('/login?to=%2Fbodies%2F1%2Fboards');
    });
});
