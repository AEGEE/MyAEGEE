// Board view of the Summer Universities (/summeruniversity/boardview): the applications of the
// members of a body whose board the member is on, and the board's comments on them.
import type { Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { forbidden, ok } from '../support/factories/base.ts';
import { body, circle } from '../support/factories/core.ts';
import { suApplication, suApplicationPermissions, suBoardviewApplication, type SuBoardviewApplication } from '../support/factories/summeruniversity.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { dialog, expectEmptyTable, openMenu, tableRows, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

// What a service answers when its database can't be reached.
const DATABASE_DOWN = 'connect ECONNREFUSED 127.0.0.1:5432';

// What core answers when the page asks where the member may approve members for SUs: the
// circles that hold that permission, with the bodies they belong to.
const boardOf = (api: ApiMock, bodyIds: number[]) => {
    api.json('POST core /my_permissions', ok(bodyIds.map((bodyId) => circle({ name: `Board of ${bodyId}`, body_id: bodyId }))));
};

// An answer the test lets through when it wants to: `answer` waits in the mock until `release()`.
const held = () => {
    let release!: () => void;
    const released = new Promise<void>((resolve) => { release = resolve; });
    return { release, released };
};

// Two frames: the page has handled an answer that arrived by then.
const settle = (page: Page) => page.evaluate(() => new Promise((resolve) => { requestAnimationFrame(() => requestAnimationFrame(resolve)); }));

// The page asked for the applications of this body (the mock records a call only once it has
// answered it).
const askedFor = (page: Page, bodyId: number) => page.waitForRequest((request) => request.url().endsWith(`/boardview/${bodyId}`));

const dana = () => suBoardviewApplication({
    id: 41,
    user_id: 7,
    first_name: 'Dana',
    last_name: 'Other',
    body_id: 4,
    body_name: 'AEGEE-Other',
    event: { id: 22, name: 'Seaside Pilot', url: 'seaside' }
});

const alex = (overrides: Partial<Omit<SuBoardviewApplication, 'event'>> = {}) => suBoardviewApplication({
    id: 31,
    user_id: 2,
    first_name: 'Alex',
    last_name: 'Member',
    status: 'pending',
    updated_at: '2027-02-10T09:00:00.000Z',
    event: { id: 21, name: 'Mountains and Languages', url: 'mountains', questions: [{ name: '', description: 'Why this SU?' }] },
    ...overrides
});

test.describe('Summer University board view', () => {
    test.use({ session: 'board' });

    test('a member who is on no board is told so', async ({ page, api }) => {
        boardOf(api, []);

        await page.goto('/summeruniversity/boardview');

        await expect(page.getByRole('heading', { name: 'Board view', level: 1 })).toBeVisible();
        await expect(page.getByText('You are not a board member of any body.')).toBeVisible();
        await expect(page.getByRole('table')).toHaveCount(0);
        expect(api.callsTo('POST core /my_permissions').map((call) => call.body)).toEqual([{ action: 'approve_members', object: 'summeruniversity' }]);
    });

    test('a board member of one body sees its applications, the newest change first', async ({ page, api }) => {
        boardOf(api, [1]);
        api.json('GET summeruniversity /boardview/:body_id', ok([
            alex(),
            suBoardviewApplication({ id: 32, user_id: 7, first_name: 'Dana', last_name: 'Newest', status: 'accepted', updated_at: '2027-02-20T09:00:00.000Z', event: { id: 22, name: 'Seaside Pilot', url: 'seaside' } }),
            suBoardviewApplication({ id: 33, user_id: 8, first_name: 'Eli', last_name: 'Oldest', status: 'rejected', updated_at: '2027-01-05T09:00:00.000Z' })
        ]));

        await page.goto('/summeruniversity/boardview');

        await expect(page.getByText('You are currently viewing applications from AEGEE-Antenna.')).toBeVisible();
        await expect(page.getByText('To allow for an anonymous selection procedure, please do not provide any personal information here')).toBeVisible();
        const table = page.getByRole('table');
        await expect(tableRows(table)).toHaveText([/Dana Newest/, /Alex Member/, /Eli Oldest/]);

        const newest = tableRows(table).filter({ hasText: 'Dana Newest' });
        await expect(newest).toContainText('2027-02-20 10:00');
        await expect(newest).toContainText('Accepted');
        await expect(newest.getByRole('link', { name: 'Seaside Pilot' })).toHaveAttribute('href', '/summeruniversity/seaside');
        await expect(newest.getByRole('link', { name: 'Dana Newest' })).toHaveAttribute('href', '/members/7');
        await expect(tableRows(table).filter({ hasText: 'Alex Member' })).toContainText('Pending');
        await expect(tableRows(table).filter({ hasText: 'Eli Oldest' })).toContainText('Rejected');
        expect(api.callsTo('GET summeruniversity /boardview/:body_id').map((call) => call.params)).toEqual([{ body_id: '1' }]);
    });

    test('a board member of several bodies chooses which one to see', async ({ page, api, me }) => {
        me!.bodies = [body({ id: 1, name: 'AEGEE-Antenna' }), body({ id: 4, name: 'AEGEE-Other' }), body({ id: 5, name: 'AEGEE-Not on its board' })];
        boardOf(api, [1, 4]);
        api.json('GET summeruniversity /boardview/:body_id', ok([alex({ body_id: 4, body_name: 'AEGEE-Other' })]));

        await page.goto('/summeruniversity/boardview');

        await expect(page.getByText('You haven\'t selected the antenna yet.')).toBeVisible();
        const bodies = page.getByRole('combobox', { name: 'Select the body to view application from:' });
        await expect(bodies.getByRole('option')).toHaveText(['AEGEE-Antenna', 'AEGEE-Other']);
        expect(api.callsTo('GET summeruniversity /boardview/:body_id')).toEqual([]);

        await bodies.selectOption('AEGEE-Other');

        await expect(tableRows(page.getByRole('table')).filter({ hasText: 'Alex Member' })).toBeVisible();
        await expect(page.getByText('You haven\'t selected the antenna yet.')).toHaveCount(0);
        expect(api.callsTo('GET summeruniversity /boardview/:body_id').map((call) => call.params)).toEqual([{ body_id: '4' }]);
    });

    test('saving a board comment', async ({ page, api }) => {
        boardOf(api, [1]);
        api.json('GET summeruniversity /boardview/:body_id', ok([alex()]));
        api.json('PUT summeruniversity /single/:id/applications/:application_id/comment', ok(suApplication({ id: 31, board_comment: 'Active member' })));

        await page.goto('/summeruniversity/boardview');
        await page.getByRole('textbox', { name: 'Board comment for Alex Member' }).fill('Active member');
        await tableRows(page.getByRole('table')).filter({ hasText: 'Alex Member' }).getByRole('button', { name: 'Save' }).click();

        await expect(toast(page, 'Participant comment is updated.')).toBeVisible();
        expect(api.callsTo('PUT summeruniversity /single/:id/applications/:application_id/comment').map((call) => [call.params, call.body]))
            .toEqual([[{ id: '21', application_id: '31' }, { board_comment: 'Active member' }]]);
    });

    test('a refused board comment shows why', async ({ page, api }) => {
        boardOf(api, [1]);
        api.json('GET summeruniversity /boardview/:body_id', ok([alex()]));
        api.on('PUT summeruniversity /single/:id/applications/:application_id/comment', { status: 403, json: forbidden('You are not allowed to put board comments') });

        await page.goto('/summeruniversity/boardview');
        await page.getByRole('textbox', { name: 'Board comment for Alex Member' }).fill('Active member');
        await page.getByRole('button', { name: 'Save' }).click();

        await expect(toast(page, 'Could not update participant comment: You are not allowed to put board comments')).toBeVisible();
    });

    test('failing to load the applications shows why', async ({ page, api }) => {
        boardOf(api, [1]);
        api.on('GET summeruniversity /boardview/:body_id', { status: 403, json: forbidden('You are not allowed to see this') });

        await page.goto('/summeruniversity/boardview');

        await expect(toast(page, 'Error fetching board view data: You are not allowed to see this')).toBeVisible();
    });

    test('failing to load the boards the member is on shows why', async ({ page, api }) => {
        api.on('POST core /my_permissions', { status: 500, json: { success: false, message: DATABASE_DOWN } });

        await page.goto('/summeruniversity/boardview');

        await expect(toast(page, `Could not fetch your board bodies: ${DATABASE_DOWN}`)).toBeVisible();
        await expect(page.getByText('You are not a board member of any body.')).toHaveCount(0);
    });

    test('a body without applications shows "Nothing here."', async ({ page, api }) => {
        boardOf(api, [1]);
        api.json('GET summeruniversity /boardview/:body_id', ok([]));

        await page.goto('/summeruniversity/boardview');

        await expect.poll(() => api.callsTo('GET summeruniversity /boardview/:body_id').length).toBe(1);
        await expectEmptyTable(page.getByRole('table'));
    });

    test('"View application" shows the application with the questions of its SU', async ({ page, api }) => {
        boardOf(api, [1]);
        api.json('GET summeruniversity /boardview/:body_id', ok([alex()]));
        api.json('GET summeruniversity /single/:id/applications/:application_id', ok(
            suApplication({ id: 31, answers: ['Because of the mountains'], board_comment: 'Active member' }),
            { permissions: suApplicationPermissions({ apply: false, see_own_application: false, edit_application: false, set_application_cancelled: false }) }
        ));

        await page.goto('/summeruniversity/boardview');
        await page.getByRole('button', { name: 'View application' }).click();

        const modal = dialog(page, 'View participant');
        await expect(modal.getByRole('row').filter({ hasText: 'Why this SU?' })).toContainText('Because of the mountains');
        await expect(modal.getByRole('row').filter({ hasText: 'Board comment' })).toContainText('Active member');
        expect(api.callsTo('GET summeruniversity /single/:id/applications/:application_id').map((call) => call.params)).toEqual([{ id: '21', application_id: '31' }]);
    });

    test('a failing "View application" shows why', async ({ page, api }) => {
        boardOf(api, [1]);
        api.json('GET summeruniversity /boardview/:body_id', ok([alex()]));
        api.on('GET summeruniversity /single/:id/applications/:application_id', { status: 403, json: forbidden('You are not allowed to see this application.') });

        await page.goto('/summeruniversity/boardview');
        await page.getByRole('button', { name: 'View application' }).click();

        await expect(toast(page, 'Could not fetch the application: You are not allowed to see this application.')).toBeVisible();
        await expect(dialog(page, 'View participant')).toHaveCount(0);
    });

    test.describe('switching bodies', () => {
        test.beforeEach(({ me }) => {
            me!.bodies = [body({ id: 1, name: 'AEGEE-Antenna' }), body({ id: 4, name: 'AEGEE-Other' })];
        });

        test('a late answer for the body chosen before is not shown', async ({ page, api }) => {
            boardOf(api, [1, 4]);
            const first = held();
            api.on('GET summeruniversity /boardview/:body_id', async ({ params }) => {
                if (params.body_id === '1') {
                    await first.released;
                    return { json: ok([alex()]) };
                }
                return { json: ok([dana()]) };
            });

            await page.goto('/summeruniversity/boardview');
            const bodies = page.getByRole('combobox', { name: 'Select the body to view application from:' });
            const asked = askedFor(page, 1);
            await bodies.selectOption('AEGEE-Antenna');
            await asked;
            await bodies.selectOption('AEGEE-Other');
            const table = page.getByRole('table');
            await expect(tableRows(table)).toHaveText([/Dana Other/]);

            const late = page.waitForResponse((response) => response.url().endsWith('/boardview/1'));
            first.release();
            await late;
            await settle(page);

            await expect(tableRows(table)).toHaveText([/Dana Other/]);
            await expect(bodies).toHaveValue('4');
        });

        test('the applications of the body chosen before are gone while the next body loads', async ({ page, api }) => {
            boardOf(api, [1, 4]);
            const second = held();
            api.on('GET summeruniversity /boardview/:body_id', async ({ params }) => {
                if (params.body_id === '4') {
                    await second.released;
                    return { json: ok([dana()]) };
                }
                return { json: ok([alex()]) };
            });

            await page.goto('/summeruniversity/boardview');
            const bodies = page.getByRole('combobox', { name: 'Select the body to view application from:' });
            await bodies.selectOption('AEGEE-Antenna');
            const table = page.getByRole('table');
            await expect(tableRows(table)).toHaveText([/Alex Member/]);

            const asked = askedFor(page, 4);
            await bodies.selectOption('AEGEE-Other');
            await asked;

            // Nothing of AEGEE-Antenna can be saved or opened under AEGEE-Other.
            await expect(page.getByText('Alex Member')).toHaveCount(0);
            await expect(page.getByRole('button', { name: 'View application' })).toHaveCount(0);

            second.release();
            await expect(tableRows(table)).toHaveText([/Dana Other/]);
        });

        test('a late error for the body chosen before is not shown, and the next body can be worked on', async ({ page, api }) => {
            boardOf(api, [1, 4]);
            const first = held();
            api.on('GET summeruniversity /boardview/:body_id', async ({ params }) => {
                if (params.body_id === '1') {
                    await first.released;
                    return { status: 500, json: { success: false, message: DATABASE_DOWN } };
                }
                return { json: ok([dana()]) };
            });
            api.json('PUT summeruniversity /single/:id/applications/:application_id/comment', ok(suApplication({ id: 41, board_comment: 'Active member' })));

            await page.goto('/summeruniversity/boardview');
            const bodies = page.getByRole('combobox', { name: 'Select the body to view application from:' });
            const asked = askedFor(page, 1);
            await bodies.selectOption('AEGEE-Antenna');
            await asked;
            await bodies.selectOption('AEGEE-Other');
            const table = page.getByRole('table');
            await expect(tableRows(table)).toHaveText([/Dana Other/]);

            const late = page.waitForResponse((response) => response.url().endsWith('/boardview/1'));
            first.release();
            await late;
            await settle(page);

            await expect(toast(page, /Error fetching board view data/)).toHaveCount(0);
            await expect(tableRows(table)).toHaveText([/Dana Other/]);
            // Nothing is left loading over the table: the board can save its comment.
            await page.getByRole('textbox', { name: 'Board comment for Dana Other' }).fill('Active member');
            await tableRows(table).filter({ hasText: 'Dana Other' }).getByRole('button', { name: 'Save' }).click();
            await expect(toast(page, 'Participant comment is updated.')).toBeVisible();
            expect(api.callsTo('PUT summeruniversity /single/:id/applications/:application_id/comment').map((call) => call.params)).toEqual([{ id: '22', application_id: '41' }]);
        });
    });

    test('leaving while the applications load: a later failure is not shown and the member stays where they went', async ({ page, api, layout }) => {
        boardOf(api, [1]);
        const answer = held();
        api.on('GET summeruniversity /boardview/:body_id', async () => {
            await answer.released;
            return { status: 500, json: { success: false, message: DATABASE_DOWN } };
        });
        api.fallback(mockEverything);

        const asked = askedFor(page, 1);
        await page.goto('/summeruniversity/boardview');
        await asked;
        await (await openMenu(page, layout)).getByRole('link', { name: 'Dashboard' }).click();
        await expect(page).toHaveURL('/dashboard');

        const late = page.waitForResponse((response) => response.url().endsWith('/boardview/1'));
        answer.release();
        await late;
        await settle(page);

        await expect(toast(page, /Error fetching board view data/)).toHaveCount(0);
        await expect(page).toHaveURL('/dashboard');
    });

    test('leaving while the boards load: a later failure is not shown', async ({ page, api, layout }) => {
        const answer = held();
        api.on('POST core /my_permissions', async () => {
            await answer.released;
            return { status: 500, json: { success: false, message: DATABASE_DOWN } };
        });
        api.fallback(mockEverything);

        const asked = page.waitForRequest((request) => request.method() === 'POST' && request.url().includes('/my_permissions'));
        await page.goto('/summeruniversity/boardview');
        await asked;
        await (await openMenu(page, layout)).getByRole('link', { name: 'Dashboard' }).click();
        await expect(page).toHaveURL('/dashboard');

        const late = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/my_permissions'));
        answer.release();
        await late;
        await settle(page);

        await expect(toast(page, /Could not fetch your board bodies/)).toHaveCount(0);
        await expect(page).toHaveURL('/dashboard');
    });
});
