// Creating a circle (/circles/new) and editing one (/circles/:id/edit): its name and
// description, and on the edit page its parent, its child circles and its permissions.
import type { Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { forbidden, notFound, ok, okList, unprocessable, validationError } from '../support/factories/base.ts';
import { circle, permission } from '../support/factories/core.ts';
import { circleDetail, type CircleDetail } from '../support/factories/core-circles.ts';
import { toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const ERROR = { success: false, message: 'Something went wrong on the server.' };

const name = (page: Page) => page.getByRole('textbox', { name: 'Name' });
const description = (page: Page) => page.getByRole('textbox', { name: 'Description' });
const save = (page: Page) => page.getByRole('button', { name: 'Save circle' });
const parentField = (page: Page) => page.getByRole('textbox', { name: 'Parent circle' });
const childField = (page: Page) => page.getByRole('textbox', { name: 'Add child circle' });
const permissionField = (page: Page) => page.getByRole('textbox', { name: 'Add permission' });
// An option of a search field, named by its circle's name or permission's code and description.
const option = (page: Page, text: string) => page.getByRole('button', { name: new RegExp(`^${text}`) });

// The circle page, where saving leads.
const showCirclePage = (api: ApiMock, shown: CircleDetail) => {
    api.json('GET core /circles/:id', ok(shown));
    api.json('GET core /circles/:id/my_permissions', ok([]));
    api.json('GET core /circles/:id/permissions', okList([]));
};

const NETCOM = circle({ id: 7, name: 'Network Commission', description: 'Supports the antennae of a region' });
const ITC = circle({ id: 8, name: 'IT Committee', description: 'Keeps MyAEGEE running' });

// The circle on the edit page: one without parent, children or permissions unless given.
const editing = (api: ApiMock, overrides: Partial<CircleDetail> = {}) => {
    const shown = circleDetail({ id: 5, name: 'Comité Directeur', description: 'The board of AEGEE-Europe', ...overrides });
    api.json('GET core /circles/:id', ok(shown));
    return shown;
};

test.describe('creating a circle', () => {
    test('saves the name and the description and opens the new circle', async ({ page, api }) => {
        api.json('POST core /circles', ok(circle({ id: 61, name: 'Summer Team', description: 'Organises the summer' })));
        showCirclePage(api, circleDetail({ id: 61, name: 'Summer Team' }));
        await page.goto('/circles/new');

        await expect(page.getByRole('heading', { name: 'Create circle' })).toBeVisible();
        await name(page).fill('Summer Team');
        await description(page).fill('Organises the summer');
        await save(page).click();

        await expect(toast(page, 'Circle is saved.')).toBeVisible();
        await expect(page).toHaveURL('/circles/61');
        await expect.poll(() => api.callsTo('POST core /circles').map((call) => call.body)).toEqual([{ name: 'Summer Team', description: 'Organises the summer' }]);
    });

    test('has only the name and the description', async ({ page }) => {
        await page.goto('/circles/new');

        await expect(name(page)).toHaveValue('');
        await expect(description(page)).toHaveValue('');
        await expect(page.getByRole('checkbox')).toHaveCount(0);
        await expect(parentField(page)).toHaveCount(0);
        await expect(childField(page)).toHaveCount(0);
        await expect(permissionField(page)).toHaveCount(0);
    });

    test('needs a name and a description before it sends anything', async ({ page, api }) => {
        await page.goto('/circles/new');

        await save(page).click();
        expect(await name(page).evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
        await name(page).fill('Summer Team');
        await save(page).click();
        expect(await description(page).evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);

        expect(api.callsTo('POST core /circles')).toHaveLength(0);
    });

    test('shows what the server found wrong with each field', async ({ page, api }) => {
        api.on('POST core /circles', { status: 422, json: validationError({ name: ['Name should be set.'], description: ['Description should be set.', 'Description is too short.'] }) });
        await page.goto('/circles/new');

        // Spaces only: the browser takes them, the server trims them away.
        await name(page).fill(' ');
        await description(page).fill(' ');
        await save(page).click();

        await expect(toast(page, 'Some of the circle data is invalid.')).toBeVisible();
        await expect(page.getByText('Name should be set.')).toBeVisible();
        await expect(page.getByText('Description should be set., Description is too short.')).toBeVisible();
        await expect(save(page)).toBeEnabled();
        await expect(page).toHaveURL('/circles/new');
    });

    test('says why the circle could not be created', async ({ page, api }) => {
        api.on('POST core /circles', { status: 403, json: forbidden('Permission global:create:circle is required, but not present.') });
        await page.goto('/circles/new');

        await name(page).fill('Summer Team');
        await description(page).fill('Organises the summer');
        await save(page).click();

        await expect(toast(page, 'Could not save circle: Permission global:create:circle is required, but not present.')).toBeVisible();
        await expect(page).toHaveURL('/circles/new');
        await expect(save(page)).toBeEnabled();
    });

    test('can not be saved twice while it is being saved', async ({ page, api }) => {
        api.on('POST core /circles', { json: ok(circle({ id: 61 })), delayMs: 1000 });
        showCirclePage(api, circleDetail({ id: 61 }));
        await page.goto('/circles/new');

        await name(page).fill('Summer Team');
        await description(page).fill('Organises the summer');
        await save(page).click();

        await expect(save(page)).toBeDisabled();
        await expect(page).toHaveURL('/circles/61');
        await expect.poll(() => api.callsTo('POST core /circles')).toHaveLength(1);
    });
});

test.describe('editing a circle', () => {
    test('shows the circle in the form and saves the changes', async ({ page, api }) => {
        editing(api);
        api.json('PUT core /circles/:id', ok(circle({ id: 5, name: 'Comité Directeur', description: 'The board' })));
        await page.goto('/circles/5/edit');

        await expect(page.getByRole('heading', { name: 'Edit circle' })).toBeVisible();
        await expect(name(page)).toHaveValue('Comité Directeur');
        await expect(description(page)).toHaveValue('The board of AEGEE-Europe');
        await description(page).fill('The board');
        showCirclePage(api, circleDetail({ id: 5, name: 'Comité Directeur' }));
        await save(page).click();

        await expect(toast(page, 'Circle is saved.')).toBeVisible();
        await expect(page).toHaveURL('/circles/5');
        await expect.poll(() => api.callsTo('PUT core /circles/:id').map((call) => [call.params.id, call.body])).toEqual([['5', { name: 'Comité Directeur', description: 'The board' }]]);
    });

    test('has no setting for joining the circle', async ({ page, api }) => {
        editing(api);
        await page.goto('/circles/5/edit');

        await expect(name(page)).toHaveValue('Comité Directeur');
        await expect(page.getByRole('checkbox')).toHaveCount(0);
        await expect(page.getByText('Joinable?')).toHaveCount(0);
    });

    test('says so when the circle does not exist', async ({ page, api }) => {
        api.on('GET core /circles/:id', { status: 404, json: notFound('Circle is not found.') });
        api.json('GET core /circles', okList([]));
        await page.goto('/circles/5/edit');

        await expect(toast(page, 'Circle is not found')).toBeVisible();
        await expect(page).toHaveURL('/circles');
    });

    test('says why the circle could not be loaded', async ({ page, api }) => {
        api.on('GET core /circles/:id', { status: 500, json: ERROR });
        api.json('GET core /circles', okList([]));
        await page.goto('/circles/5/edit');

        await expect(toast(page, 'Some error happened: Something went wrong on the server.')).toBeVisible();
        await expect(page).toHaveURL('/circles');
    });

    test('shows a circle without parent, children and permissions', async ({ page, api }) => {
        editing(api);
        await page.goto('/circles/5/edit');

        await expect(page.getByText('Not set.')).toBeVisible();
        await expect(page.getByText('No child circles attached.')).toBeVisible();
        await expect(page.getByText('No permissions attached.')).toBeVisible();
    });

    test('shows the parent, the child circles and the permissions', async ({ page, api }) => {
        editing(api, {
            parent_circle: NETCOM,
            child_circles: [ITC, circle({ name: 'Summer Team' })],
            permissions: [permission('global:view:member'), permission('global:create:event')]
        });
        await page.goto('/circles/5/edit');

        await expect(page.getByRole('button', { name: 'Network Commission (Click to unset)' })).toBeVisible();
        await expect(page.getByText('Not set.')).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Remove child circle IT Committee' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Remove child circle Summer Team' })).toBeVisible();
        await expect(page.getByText('No child circles attached.')).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Remove permission global:view:member' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Remove permission global:create:event' })).toBeVisible();
        await expect(page.getByText('No permissions attached.')).toHaveCount(0);
    });

    test.describe('the parent circle', () => {
        test('is chosen from the circles found by name', async ({ page, api }) => {
            editing(api);
            api.on('GET core /circles', ({ query }) => ({ json: okList(query.get('query') === 'net' ? [NETCOM] : []) }));
            api.json('PUT core /circles/:id/parent', { success: true, message: 'Circle parent is updated.' });
            await page.goto('/circles/5/edit');

            await parentField(page).fill('net');
            await option(page, 'Network Commission Supports the antennae of a region').click();

            await expect(toast(page, 'Parent circle is set.')).toBeVisible();
            await expect(page.getByRole('button', { name: 'Network Commission (Click to unset)' })).toBeVisible();
            await expect.poll(() => api.callsTo('GET core /circles').map((call) => Object.fromEntries(call.query))).toEqual([{ query: 'net' }]);
            await expect.poll(() => api.callsTo('PUT core /circles/:id/parent').map((call) => [call.params.id, call.body])).toEqual([['5', { parent_circle_id: 7 }]]);
        });

        test('is unset with its button', async ({ page, api }) => {
            editing(api, { parent_circle: NETCOM });
            api.json('PUT core /circles/:id/parent', { success: true, message: 'Circle parent is unset.' });
            await page.goto('/circles/5/edit');

            await page.getByRole('button', { name: 'Network Commission (Click to unset)' }).click();

            await expect(toast(page, 'Parent circle is unset.')).toBeVisible();
            await expect(page.getByText('Not set.')).toBeVisible();
            await expect.poll(() => api.callsTo('PUT core /circles/:id/parent').map((call) => [call.params.id, call.body])).toEqual([['5', { parent_circle_id: null }]]);
        });

        test('says why it could not be set', async ({ page, api }) => {
            editing(api);
            api.json('GET core /circles', okList([NETCOM]));
            api.on('PUT core /circles/:id/parent', { status: 404, json: notFound('No parent circle found.') });
            await page.goto('/circles/5/edit');

            await parentField(page).fill('net');
            await option(page, 'Network Commission').click();

            await expect(toast(page, 'Could not set parent circle: No parent circle found.')).toBeVisible();
            await expect(page.getByText('Not set.')).toBeVisible();
        });

        test('says so when the circle would be its own parent', async ({ page, api }) => {
            editing(api);
            api.json('GET core /circles', okList([NETCOM]));
            // What core answers when the new parent is below the circle already.
            api.on('PUT core /circles/:id/parent', { status: 422, json: unprocessable('There\'s a loop in circles, check ID 5') });
            await page.goto('/circles/5/edit');

            await parentField(page).fill('net');
            await option(page, 'Network Commission').click();

            await expect(toast(page, 'Could not set parent circle: There\'s a loop in circles, check ID 5')).toBeVisible();
            await expect(page.getByText('Not set.')).toBeVisible();
        });

        test('says why it could not be unset', async ({ page, api }) => {
            editing(api, { parent_circle: NETCOM });
            api.on('PUT core /circles/:id/parent', { status: 403, json: forbidden('Permission global:put_parent:circle is required, but not present.') });
            await page.goto('/circles/5/edit');

            await page.getByRole('button', { name: 'Network Commission (Click to unset)' }).click();

            await expect(toast(page, 'Could not unset parent circle: Permission global:put_parent:circle is required, but not present.')).toBeVisible();
            await expect(page.getByRole('button', { name: 'Network Commission (Click to unset)' })).toBeVisible();
        });

        test('shows only the circles of the last search while typing', async ({ page, api }) => {
            editing(api);
            api.on('GET core /circles', ({ query }) => {
                if (query.get('query') !== 'n') return { json: okList([NETCOM]) };
                // The answer to the first letter would come last; the page doesn't wait for it.
                return { json: okList([circle({ name: 'North Circle' })]), delayMs: 1000 };
            });
            await page.goto('/circles/5/edit');

            // The first search is still on its way when the second starts.
            await parentField(page).pressSequentially('ne');

            await expect(option(page, 'Network Commission')).toBeVisible();
            await expect(option(page, 'North Circle')).toHaveCount(0);
            await expect(toast(page, 'Could not fetch circles')).toHaveCount(0);
        });

        test('says why the circles could not be searched', async ({ page, api }) => {
            editing(api);
            api.on('GET core /circles', { status: 500, json: ERROR });
            await page.goto('/circles/5/edit');

            await parentField(page).fill('net');

            await expect(toast(page, 'Could not fetch circles: Something went wrong on the server.')).toBeVisible();
        });

        test('an emptied field searches for nothing', async ({ page, api }) => {
            editing(api);
            api.json('GET core /circles', okList([NETCOM]));
            await page.goto('/circles/5/edit');

            await parentField(page).fill('net');
            await expect(option(page, 'Network Commission')).toBeVisible();
            await parentField(page).fill('');

            await expect(parentField(page)).toHaveValue('');
            await expect.poll(() => api.callsTo('GET core /circles').map((call) => call.query.get('query'))).toEqual(['net']);
        });
    });

    test('two fields can search at the same time', async ({ page, api }) => {
        editing(api);
        // The circles answer later than the permissions.
        api.on('GET core /circles', { json: okList([NETCOM]), delayMs: 1000 });
        api.json('GET core /permissions', okList([permission('global:view:member')]));
        await page.goto('/circles/5/edit');

        await parentField(page).fill('net');
        await permissionField(page).fill('view');
        await expect(option(page, 'global:view:member')).toBeVisible();
        await expect.poll(() => api.callsTo('GET core /circles').map((call) => call.status)).toEqual([200]);

        // The answer to the first search is there when the member goes back to it.
        await parentField(page).click();
        await expect(option(page, 'Network Commission')).toBeVisible();
    });

    test.describe('the child circles', () => {
        test('get a circle found by name', async ({ page, api }) => {
            editing(api);
            api.on('GET core /circles', ({ query }) => ({ json: okList(query.get('query') === 'it' ? [ITC] : []) }));
            api.json('PUT core /circles/:id/parent', { success: true, message: 'Circle parent is updated.' });
            await page.goto('/circles/5/edit');

            await childField(page).fill('it');
            await option(page, 'IT Committee Keeps MyAEGEE running').click();

            await expect(toast(page, 'Child circle is added.')).toBeVisible();
            await expect(page.getByRole('button', { name: 'Remove child circle IT Committee' })).toBeVisible();
            await expect(page.getByText('No child circles attached.')).toHaveCount(0);
            // The child gets this circle as its parent.
            await expect.poll(() => api.callsTo('PUT core /circles/:id/parent').map((call) => [call.params.id, call.body])).toEqual([['8', { parent_circle_id: 5 }]]);
        });

        test('show a circle that is added again only once', async ({ page, api }) => {
            editing(api, { child_circles: [ITC] });
            api.json('GET core /circles', okList([ITC]));
            api.json('PUT core /circles/:id/parent', { success: true, message: 'Circle parent is updated.' });
            await page.goto('/circles/5/edit');

            await childField(page).fill('it');
            await option(page, 'IT Committee').click();

            await expect(toast(page, 'Child circle is added.')).toBeVisible();
            await expect(page.getByRole('button', { name: 'Remove child circle IT Committee' })).toHaveCount(1);
        });

        test('say why a circle could not be added', async ({ page, api }) => {
            editing(api);
            api.json('GET core /circles', okList([ITC]));
            api.on('PUT core /circles/:id/parent', { status: 422, json: unprocessable('There\'s a loop in circles, check ID 8') });
            await page.goto('/circles/5/edit');

            await childField(page).fill('it');
            await option(page, 'IT Committee').click();

            await expect(toast(page, 'Could not add child circle: There\'s a loop in circles, check ID 8')).toBeVisible();
            await expect(page.getByText('No child circles attached.')).toBeVisible();
        });

        test('say why a circle could not be added when the server refuses it', async ({ page, api }) => {
            editing(api);
            api.json('GET core /circles', okList([ITC]));
            api.on('PUT core /circles/:id/parent', { status: 403, json: forbidden('Permission global:put_parent:circle is required, but not present.') });
            await page.goto('/circles/5/edit');

            await childField(page).fill('it');
            await option(page, 'IT Committee').click();

            await expect(toast(page, 'Could not add child circle: Permission global:put_parent:circle is required, but not present.')).toBeVisible();
        });

        test('lose a circle with its remove button', async ({ page, api }) => {
            editing(api, { child_circles: [ITC] });
            api.json('PUT core /circles/:id/parent', { success: true, message: 'Circle parent is unset.' });
            await page.goto('/circles/5/edit');

            await page.getByRole('button', { name: 'Remove child circle IT Committee' }).click();

            await expect(toast(page, 'Child circle is removed')).toBeVisible();
            await expect(page.getByText('No child circles attached.')).toBeVisible();
            await expect.poll(() => api.callsTo('PUT core /circles/:id/parent').map((call) => [call.params.id, call.body])).toEqual([['8', { parent_circle_id: null }]]);
        });

        test('say why a circle could not be removed', async ({ page, api }) => {
            editing(api, { child_circles: [ITC] });
            api.on('PUT core /circles/:id/parent', { status: 500, json: ERROR });
            await page.goto('/circles/5/edit');

            await page.getByRole('button', { name: 'Remove child circle IT Committee' }).click();

            await expect(toast(page, 'Could not remove child circle: Something went wrong on the server.')).toBeVisible();
            await expect(page.getByRole('button', { name: 'Remove child circle IT Committee' })).toBeVisible();
        });
    });

    test.describe('the permissions', () => {
        test('get a permission found by its code', async ({ page, api }) => {
            const viewMember = { ...permission('global:view:member'), id: 31, description: 'View all members' };
            editing(api);
            api.on('GET core /permissions', ({ query }) => ({ json: okList(query.get('query') === 'view' ? [viewMember] : []) }));
            api.json('POST core /circles/:id/permissions', ok({ circle_id: 5, permission_id: 31 }));
            await page.goto('/circles/5/edit');

            await permissionField(page).fill('view');
            await option(page, 'global:view:member View all members').click();

            await expect(toast(page, 'Permission is added.')).toBeVisible();
            await expect(page.getByRole('button', { name: 'Remove permission global:view:member' })).toBeVisible();
            await expect(page.getByText('No permissions attached.')).toHaveCount(0);
            await expect.poll(() => api.callsTo('GET core /permissions').map((call) => Object.fromEntries(call.query))).toEqual([{ query: 'view' }]);
            await expect.poll(() => api.callsTo('POST core /circles/:id/permissions').map((call) => [call.params.id, call.body])).toEqual([['5', { permission_id: 31 }]]);
        });

        test('say so when the circle has the permission already', async ({ page, api }) => {
            editing(api);
            api.json('GET core /permissions', okList([permission('global:view:member')]));
            api.on('POST core /circles/:id/permissions', { status: 422, json: validationError({ circle_id: ['circle_id must be unique'], permission_id: ['permission_id must be unique'] }) });
            await page.goto('/circles/5/edit');

            await permissionField(page).fill('view');
            await option(page, 'global:view:member').click();

            await expect(toast(page, 'Could not add permission: circle_id must be unique; permission_id must be unique')).toBeVisible();
            await expect(page.getByText('No permissions attached.')).toBeVisible();
        });

        test('say why a permission could not be added', async ({ page, api }) => {
            editing(api);
            api.json('GET core /permissions', okList([permission('global:view:member')]));
            api.on('POST core /circles/:id/permissions', { status: 403, json: forbidden('Permission global:put_permissions:circle is required, but not present.') });
            await page.goto('/circles/5/edit');

            await permissionField(page).fill('view');
            await option(page, 'global:view:member').click();

            await expect(toast(page, 'Could not add permission: Permission global:put_permissions:circle is required, but not present.')).toBeVisible();
        });

        test('lose a permission with its remove button', async ({ page, api }) => {
            const viewMember = { ...permission('global:view:member'), id: 31 };
            editing(api, { permissions: [viewMember, permission('global:create:event')] });
            api.json('DELETE core /circles/:id/permissions/:permission_id', { success: true, message: 'Permission is deleted.' });
            await page.goto('/circles/5/edit');

            await page.getByRole('button', { name: 'Remove permission global:view:member' }).click();

            await expect(toast(page, 'Permission is deleted.')).toBeVisible();
            await expect(page.getByRole('button', { name: 'Remove permission global:view:member' })).toHaveCount(0);
            await expect(page.getByRole('button', { name: 'Remove permission global:create:event' })).toBeVisible();
            await expect.poll(() => api.callsTo('DELETE core /circles/:id/permissions/:permission_id').map((call) => call.params)).toEqual([{ id: '5', permission_id: '31' }]);
        });

        test('say why a permission could not be removed', async ({ page, api }) => {
            editing(api, { permissions: [permission('global:view:member')] });
            api.on('DELETE core /circles/:id/permissions/:permission_id', { status: 404, json: notFound('The permission does not belong to this circle.') });
            await page.goto('/circles/5/edit');

            await page.getByRole('button', { name: 'Remove permission global:view:member' }).click();

            await expect(toast(page, 'Could not delete permission: The permission does not belong to this circle.')).toBeVisible();
            await expect(page.getByRole('button', { name: 'Remove permission global:view:member' })).toBeVisible();
        });

        test('say why the permissions could not be searched', async ({ page, api }) => {
            editing(api);
            api.on('GET core /permissions', { status: 500, json: ERROR });
            await page.goto('/circles/5/edit');

            await permissionField(page).fill('view');

            await expect(toast(page, 'Could not fetch permissions: Something went wrong on the server.')).toBeVisible();
        });
    });
});
