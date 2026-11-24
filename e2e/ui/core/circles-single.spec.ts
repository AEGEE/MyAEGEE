// A circle's page (/circles/:id): its details, the permissions it has, and what the member may do
// with it (view its members, edit, add a member, leave, delete). Adding a member happens in the
// "Add member" dialog.
import type { Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { forbidden, notFound, ok, okList, validationError } from '../support/factories/base.ts';
import { body, bodyMembership, circle, permission } from '../support/factories/core.ts';
import { circleDetail, circlePermission, type CircleDetail, type CirclePermission } from '../support/factories/core-circles.ts';
import { memberListItem } from '../support/factories/core-members.ts';
import { dialog, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const ERROR = { success: false, message: 'Something went wrong on the server.' };

const fact = (page: Page, label: string) => page.getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: label, exact: true }) })
    .getByRole('cell');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

const ANTENNA = body({ id: 1, name: 'AEGEE-Antenna' });

// The circle page: the circle, what the member may do with it (`combined` permissions) and the
// permissions it has with those of its parents.
const showCircle = (api: ApiMock, shown: CircleDetail, combined: string[] = [], all: CirclePermission[] = []) => {
    api.json('GET core /circles/:id', ok(shown));
    api.json('GET core /circles/:id/my_permissions', ok(combined.map(permission)));
    api.json('GET core /circles/:id/permissions', okList(all));
};

const free = (overrides: Partial<CircleDetail> = {}) => circleDetail({ id: 5, name: 'Comité Directeur', description: 'The board of AEGEE-Europe', ...overrides });
const bound = (overrides: Partial<CircleDetail> = {}) => circleDetail({ id: 6, name: 'Board AEGEE-Antenna', description: 'The board of the antenna', body: ANTENNA, ...overrides });

test.describe('circle page', () => {
    test('shows a free circle without parent, children or permissions', async ({ page, api }) => {
        showCircle(api, free());

        await page.goto('/circles/5');

        await expect(page.getByRole('heading', { name: 'Comité Directeur' })).toBeVisible();
        await expect(fact(page, 'Name')).toHaveText('Comité Directeur');
        await expect(fact(page, 'Description')).toHaveText('The board of AEGEE-Europe');
        await expect(fact(page, 'Body')).toHaveText('This circle is not associated to a body');
        await expect(fact(page, 'Parent circle')).toHaveText('This circle is a toplevel circle');
        await expect(fact(page, 'Child circles')).toHaveText('This circle does not have child circles.');
        await expect(fact(page, 'Attached permissions')).toHaveText('No permissions directly attached.');
        await expect(fact(page, 'Inherited permissions')).toHaveText('No permissions inherited.');
        await expect.poll(() => api.callsTo('GET core /circles/:id').map((call) => call.params.id)).toEqual(['5']);
        await expect.poll(() => api.callsTo('GET core /circles/:id/my_permissions').map((call) => call.params.id)).toEqual(['5']);
        await expect.poll(() => api.callsTo('GET core /circles/:id/permissions').map((call) => call.params.id)).toEqual(['5']);
    });

    test('shows a bound circle with links to its body, parent, children and permissions', async ({ page, api }) => {
        const viewMember = { ...permission('global:view:member'), id: 31 };
        showCircle(api, bound({
            parent_circle: circle({ id: 2, name: 'General board circle' }),
            child_circles: [circle({ id: 8, name: 'IT team' }), circle({ id: 9, name: 'PR team' })],
            permissions: [viewMember]
        }), [], [
            // Attached to the circle itself, and given by its parent.
            circlePermission('global:view:member', { id: 31, from: [6] }),
            circlePermission('global:create:event', { id: 32, from: [2] })
        ]);

        await page.goto('/circles/6');

        await expect(fact(page, 'Body').getByRole('link', { name: 'AEGEE-Antenna' })).toHaveAttribute('href', '/bodies/1');
        await expect(fact(page, 'Parent circle').getByRole('link', { name: 'General board circle' })).toHaveAttribute('href', '/circles/2');
        await expect(fact(page, 'Child circles').getByRole('link')).toHaveText(['IT team', 'PR team']);
        await expect(fact(page, 'Child circles').getByRole('link', { name: 'PR team' })).toHaveAttribute('href', '/circles/9');
        await expect(fact(page, 'Attached permissions').getByRole('link')).toHaveText(['global:view:member']);
        await expect(fact(page, 'Attached permissions').getByRole('link')).toHaveAttribute('href', '/permissions/31');
        // Only what the circle gets from its parents.
        await expect(fact(page, 'Inherited permissions').getByRole('link')).toHaveText(['global:create:event']);
        await expect(fact(page, 'Inherited permissions').getByRole('link')).toHaveAttribute('href', '/permissions/32');
    });

    test('lists a permission as inherited when a parent gives it too', async ({ page, api }) => {
        showCircle(api, free({ permissions: [permission('global:view:member')] }), [], [
            circlePermission('global:view:member', { from: [5, 2] })
        ]);

        await page.goto('/circles/5');

        await expect(fact(page, 'Attached permissions').getByRole('link')).toHaveText(['global:view:member']);
        await expect(fact(page, 'Inherited permissions').getByRole('link')).toHaveText(['global:view:member']);
    });

    test('says nothing about joining the circle', async ({ page, api }) => {
        // A circle that was once marked as joinable, for a member who could join circles.
        showCircle(api, { ...free(), joinable: true } as CircleDetail, ['global:join:circle']);

        await page.goto('/circles/5');

        await expect(fact(page, 'Name')).toHaveText('Comité Directeur');
        await expect(page.getByRole('rowheader', { name: 'Joinable?' })).toHaveCount(0);
        await expect.poll(() => api.callsTo('GET core /circles/:id/permissions').length).toBe(1);
        await expect(button(page, 'Join circle')).toHaveCount(0);
    });

    test('managers of the circle get a way to its members, its edit page and to delete it', async ({ page, api }) => {
        showCircle(api, free(), ['global:view_members:circle', 'global:update:circle', 'global:delete:circle']);

        await page.goto('/circles/5');

        await expect(page.getByRole('link', { name: 'View members' })).toHaveAttribute('href', '/circles/5/members');
        await expect(page.getByRole('link', { name: 'Edit circle' })).toHaveAttribute('href', '/circles/5/edit');
        await expect(button(page, 'Delete circle')).toBeVisible();
    });

    test('a member who may do nothing with the circle only sees it', async ({ page, api }) => {
        showCircle(api, free());

        await page.goto('/circles/5');

        await expect(fact(page, 'Name')).toHaveText('Comité Directeur');
        await expect.poll(() => api.callsTo('GET core /circles/:id/permissions').length).toBe(1);
        await expect(page.getByRole('link', { name: 'View members' })).toHaveCount(0);
        await expect(page.getByRole('link', { name: 'Edit circle' })).toHaveCount(0);
        await expect(button(page, 'Delete circle')).toHaveCount(0);
        await expect(button(page, 'Add member')).toHaveCount(0);
        await expect(button(page, 'Leave circle')).toHaveCount(0);
    });

    test.describe('"Add member"', () => {
        test('is there on a bound circle for who may add members and see the body\'s members', async ({ page, api }) => {
            showCircle(api, bound(), ['local:add_member:circle', 'local:view_members:body']);

            await page.goto('/circles/6');

            await expect(button(page, 'Add member')).toBeVisible();
        });

        test('is there on a free circle for who may add members and see all members', async ({ page, api }) => {
            showCircle(api, free(), ['global:add_member:circle', 'global:view:member']);

            await page.goto('/circles/5');

            await expect(button(page, 'Add member')).toBeVisible();
        });

        test('is not there on a free circle for who may not see all members', async ({ page, api }) => {
            showCircle(api, free(), ['global:add_member:circle']);

            await page.goto('/circles/5');

            await expect(fact(page, 'Name')).toHaveText('Comité Directeur');
            await expect.poll(() => api.callsTo('GET core /circles/:id/permissions').length).toBe(1);
            await expect(button(page, 'Add member')).toHaveCount(0);
        });
    });

    test('following a child circle shows that circle', async ({ page, api }) => {
        api.on('GET core /circles/:id', ({ params }) => ({
            json: ok(params.id === '8' ? circleDetail({ id: 8, name: 'IT team', parent_circle: circle({ id: 5, name: 'Comité Directeur' }) }) : free({ child_circles: [circle({ id: 8, name: 'IT team' })] }))
        }));
        api.json('GET core /circles/:id/my_permissions', ok([]));
        api.json('GET core /circles/:id/permissions', okList([]));
        await page.goto('/circles/5');

        await fact(page, 'Child circles').getByRole('link', { name: 'IT team' }).click();

        await expect(page).toHaveURL('/circles/8');
        await expect(page.getByRole('heading', { name: 'IT team' })).toBeVisible();
        await expect(fact(page, 'Parent circle').getByRole('link', { name: 'Comité Directeur' })).toBeVisible();
        await expect.poll(() => api.callsTo('GET core /circles/:id').map((call) => call.params.id)).toEqual(['5', '8']);
        await expect.poll(() => api.callsTo('GET core /circles/:id/permissions').map((call) => call.params.id)).toEqual(['5', '8']);
    });

    test('says so when the circle does not exist', async ({ page, api }) => {
        api.on('GET core /circles/:id', { status: 404, json: notFound('Circle is not found.') });
        api.json('GET core /circles', okList([]));

        await page.goto('/circles/5');

        await expect(toast(page, 'Circle is not found')).toBeVisible();
        await expect(page).toHaveURL('/circles');
    });

    test('says why the circle could not be loaded', async ({ page, api }) => {
        api.json('GET core /circles/:id', ok(free()));
        api.json('GET core /circles/:id/my_permissions', ok([]));
        api.on('GET core /circles/:id/permissions', { status: 500, json: ERROR });
        api.json('GET core /circles', okList([]));

        await page.goto('/circles/5');

        await expect(toast(page, 'Some error happened: Something went wrong on the server.')).toBeVisible();
        await expect(page).toHaveURL('/circles');
    });

    test.describe('deleting the circle', () => {
        test('asks first, then deletes it and goes back to the list', async ({ page, api }) => {
            showCircle(api, free(), ['global:delete:circle']);
            api.json('DELETE core /circles/:id', { success: true, message: 'Circle is deleted.' });
            api.json('GET core /circles', okList([]));
            await page.goto('/circles/5');

            await button(page, 'Delete circle').click();
            const confirm = dialog(page, 'Deleting circle');
            await expect(confirm).toContainText('Are you sure you want to delete this circle? This action cannot be undone.');
            await confirm.getByRole('button', { name: 'Delete circle' }).click();

            await expect(toast(page, 'Circle is deleted.')).toBeVisible();
            await expect(page).toHaveURL('/circles');
            await expect.poll(() => api.callsTo('DELETE core /circles/:id').map((call) => call.params.id)).toEqual(['5']);
        });

        test('does nothing when the member changes their mind', async ({ page, api }) => {
            showCircle(api, free(), ['global:delete:circle']);
            await page.goto('/circles/5');

            await button(page, 'Delete circle').click();
            await dialog(page, 'Deleting circle').getByRole('button', { name: 'Cancel' }).click();

            await expect(dialog(page, 'Deleting circle')).toBeHidden();
            await expect(page).toHaveURL('/circles/5');
            expect(api.callsTo('DELETE core /circles/:id')).toHaveLength(0);
        });

        test('says why the circle could not be deleted', async ({ page, api }) => {
            showCircle(api, free(), ['global:delete:circle']);
            api.on('DELETE core /circles/:id', { status: 403, json: forbidden('Permission delete:circle is required, but not present.') });
            await page.goto('/circles/5');

            await button(page, 'Delete circle').click();
            await dialog(page, 'Deleting circle').getByRole('button', { name: 'Delete circle' }).click();

            await expect(toast(page, 'Could not delete circle: Permission delete:circle is required, but not present.')).toBeVisible();
            await expect(page).toHaveURL('/circles/5');
        });
    });

    test.describe('leaving the circle', () => {
        test('a member asks first, then leaves it', async ({ page, api, me }) => {
            me!.circles = [circle({ id: 5, name: 'Comité Directeur' })];
            showCircle(api, free(), ['global:join:circle']);
            api.json('DELETE core /circles/:id/members', { success: true, message: 'Membership is deleted.' });
            await page.goto('/circles/5');

            await button(page, 'Leave circle').click();
            const confirm = dialog(page, 'Leave circle');
            await expect(confirm).toContainText('Are you sure you want to leave this circle? You will probably not be able to join it later.');
            await confirm.getByRole('button', { name: 'Leave circle' }).click();

            await expect(toast(page, 'Successfully left circle.')).toBeVisible();
            await expect(button(page, 'Leave circle')).toHaveCount(0);
            // Joining a circle is not something the page offers.
            await expect(button(page, 'Join circle')).toHaveCount(0);
            await expect.poll(() => api.callsTo('DELETE core /circles/:id/members').map((call) => call.params.id)).toEqual(['5']);
        });

        test('the circle is not offered to leave again when the member comes back to it', async ({ page, api, me }) => {
            me!.circles = [circle({ id: 5, name: 'Comité Directeur' })];
            api.on('GET core /circles/:id', ({ params }) => ({
                json: ok(params.id === '8' ? circleDetail({ id: 8, name: 'IT team' }) : free({ child_circles: [circle({ id: 8, name: 'IT team' })] }))
            }));
            api.json('GET core /circles/:id/my_permissions', ok([]));
            api.json('GET core /circles/:id/permissions', okList([]));
            api.json('DELETE core /circles/:id/members', { success: true, message: 'Membership is deleted.' });
            await page.goto('/circles/5');
            await button(page, 'Leave circle').click();
            await dialog(page, 'Leave circle').getByRole('button', { name: 'Leave circle' }).click();
            await expect(toast(page, 'Successfully left circle.')).toBeVisible();

            await fact(page, 'Child circles').getByRole('link', { name: 'IT team' }).click();
            await expect(page.getByRole('heading', { name: 'IT team' })).toBeVisible();
            await page.goBack();

            await expect(page.getByRole('heading', { name: 'Comité Directeur' })).toBeVisible();
            await expect.poll(() => api.callsTo('GET core /circles/:id/permissions').length).toBe(3);
            await expect(button(page, 'Leave circle')).toHaveCount(0);
        });

        test('does nothing when the member changes their mind', async ({ page, api, me }) => {
            me!.circles = [circle({ id: 5 })];
            showCircle(api, free());
            await page.goto('/circles/5');

            await button(page, 'Leave circle').click();
            await dialog(page, 'Leave circle').getByRole('button', { name: 'Cancel' }).click();

            await expect(dialog(page, 'Leave circle')).toBeHidden();
            await expect(button(page, 'Leave circle')).toBeVisible();
            expect(api.callsTo('DELETE core /circles/:id/members')).toHaveLength(0);
        });

        test('says why the member could not leave', async ({ page, api, me }) => {
            me!.circles = [circle({ id: 5 })];
            showCircle(api, free());
            api.on('DELETE core /circles/:id/members', { status: 404, json: notFound('You are not a member.') });
            await page.goto('/circles/5');

            await button(page, 'Leave circle').click();
            await dialog(page, 'Leave circle').getByRole('button', { name: 'Leave circle' }).click();

            await expect(toast(page, 'Could not leave circle: You are not a member.')).toBeVisible();
            await expect(dialog(page, 'Leave circle')).toBeHidden();
            await expect(button(page, 'Leave circle')).toBeVisible();
        });
    });

    test.describe('the "Add member" dialog', () => {
        const search = (page: Page) => dialog(page, 'Add member').getByRole('textbox', { name: 'Search member' });
        const ALICE = memberListItem({ id: 77, first_name: 'Alice', last_name: 'Example' });

        test('opens and closes without sending anything', async ({ page, api }) => {
            showCircle(api, bound(), ['local:add_member:circle', 'local:view_members:body']);
            await page.goto('/circles/6');

            await button(page, 'Add member').click();
            await expect(dialog(page, 'Add member')).toBeVisible();
            await expect(search(page)).toBeVisible();
            await dialog(page, 'Add member').getByRole('button', { name: 'Cancel' }).click();
            await expect(dialog(page, 'Add member')).toBeHidden();

            await button(page, 'Add member').click();
            await dialog(page, 'Add member').getByRole('button', { name: 'Close' }).click();
            await expect(dialog(page, 'Add member')).toBeHidden();

            expect(api.callsTo('GET core /bodies/:body_id/members')).toHaveLength(0);
            expect(api.callsTo('POST core /circles/:id/members')).toHaveLength(0);
        });

        test('adds a member of the body to a bound circle', async ({ page, api }) => {
            showCircle(api, bound(), ['local:add_member:circle', 'local:view_members:body']);
            api.on('GET core /bodies/:body_id/members', ({ query }) => ({
                json: okList(query.get('query') === 'ali' ? [bodyMembership({ body_id: 1, user: { ...bodyMembership().user, id: 77, first_name: 'Alice', last_name: 'Example' } })] : [])
            }));
            api.json('POST core /circles/:id/members', ok({ id: 300, circle_id: 6, user_id: 77, position: null }));
            await page.goto('/circles/6');

            await button(page, 'Add member').click();
            await search(page).fill('ali');
            await dialog(page, 'Add member').getByRole('button', { name: 'Alice Example' }).click();

            await expect(toast(page, 'Member is added.')).toBeVisible();
            await expect(dialog(page, 'Add member')).toBeHidden();
            // Only the search the member typed: choosing doesn't search for everyone.
            await expect.poll(() => api.callsTo('GET core /bodies/:body_id/members').map((call) => [call.params.body_id, Object.fromEntries(call.query)])).toEqual([['1', { query: 'ali' }]]);
            await expect.poll(() => api.callsTo('POST core /circles/:id/members').map((call) => [call.params.id, call.body])).toEqual([['6', { user_id: 77 }]]);
        });

        test('searches all members for a free circle', async ({ page, api }) => {
            showCircle(api, free(), ['global:add_member:circle', 'global:view:member']);
            api.json('GET core /members', okList([ALICE]));
            api.json('POST core /circles/:id/members', ok({ id: 300, circle_id: 5, user_id: 77, position: null }));
            await page.goto('/circles/5');

            await button(page, 'Add member').click();
            await search(page).fill('ali');
            await dialog(page, 'Add member').getByRole('button', { name: 'Alice Example' }).click();

            await expect(toast(page, 'Member is added.')).toBeVisible();
            await expect.poll(() => api.callsTo('GET core /members').map((call) => Object.fromEntries(call.query))).toEqual([{ query: 'ali' }]);
            await expect.poll(() => api.callsTo('POST core /circles/:id/members').map((call) => [call.params.id, call.body])).toEqual([['5', { user_id: 77 }]]);
        });

        test('an emptied search field searches for nothing', async ({ page, api }) => {
            showCircle(api, free(), ['global:add_member:circle', 'global:view:member']);
            api.json('GET core /members', okList([ALICE]));
            await page.goto('/circles/5');

            await button(page, 'Add member').click();
            await search(page).fill('ali');
            await expect(dialog(page, 'Add member').getByRole('button', { name: 'Alice Example' })).toBeVisible();
            await search(page).fill('');

            await expect(dialog(page, 'Add member').getByRole('button', { name: 'Alice Example' })).toBeHidden();
            await expect.poll(() => api.callsTo('GET core /members').map((call) => call.query.get('query'))).toEqual(['ali']);
        });

        test('shows only the members of the last search while typing', async ({ page, api }) => {
            showCircle(api, free(), ['global:add_member:circle', 'global:view:member']);
            api.on('GET core /members', ({ query }) => {
                if (query.get('query') !== 'a') return { json: okList([ALICE]) };
                // The answer to the first letter would come last; the page doesn't wait for it.
                return { json: okList([memberListItem({ first_name: 'Anna', last_name: 'Early' })]), delayMs: 1000 };
            });
            await page.goto('/circles/5');
            await button(page, 'Add member').click();

            // The first search is still on its way when the second starts.
            await search(page).pressSequentially('al');

            await expect(dialog(page, 'Add member').getByRole('button', { name: 'Alice Example' })).toBeVisible();
            await expect(dialog(page, 'Add member').getByRole('button', { name: 'Anna Early' })).toHaveCount(0);
            await expect(toast(page, 'Could not fetch members')).toHaveCount(0);
        });

        test('says why the members could not be searched', async ({ page, api }) => {
            showCircle(api, free(), ['global:add_member:circle', 'global:view:member']);
            api.on('GET core /members', { status: 403, json: forbidden('Permission global:view:member is required, but not present.') });
            await page.goto('/circles/5');

            await button(page, 'Add member').click();
            await search(page).fill('ali');

            await expect(toast(page, 'Could not fetch members: Permission global:view:member is required, but not present.')).toBeVisible();
        });

        test('says so when the person is in the circle already', async ({ page, api }) => {
            showCircle(api, free(), ['global:add_member:circle', 'global:view:member']);
            api.json('GET core /members', okList([ALICE]));
            api.on('POST core /circles/:id/members', { status: 422, json: validationError({ circle_id: ['circle_id must be unique'], user_id: ['user_id must be unique'] }) });
            await page.goto('/circles/5');

            await button(page, 'Add member').click();
            await search(page).fill('ali');
            await dialog(page, 'Add member').getByRole('button', { name: 'Alice Example' }).click();

            await expect(toast(page, 'Could not add member: this person is already a member of this circle.')).toBeVisible();
            await expect(dialog(page, 'Add member')).toBeVisible();
        });

        test('says why the person could not be added', async ({ page, api }) => {
            showCircle(api, bound(), ['local:add_member:circle', 'local:view_members:body']);
            api.json('GET core /bodies/:body_id/members', okList([bodyMembership({ body_id: 1, user: { ...bodyMembership().user, first_name: 'Alice', last_name: 'Example' } })]));
            api.on('POST core /circles/:id/members', { status: 403, json: forbidden('The user is not a member of the body circle is bound to.') });
            await page.goto('/circles/6');

            await button(page, 'Add member').click();
            await search(page).fill('ali');
            await dialog(page, 'Add member').getByRole('button', { name: 'Alice Example' }).click();

            await expect(toast(page, 'Could not add member: The user is not a member of the body circle is bound to.')).toBeVisible();
            await expect(dialog(page, 'Add member')).toBeVisible();
        });
    });
});
