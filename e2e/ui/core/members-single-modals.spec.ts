// The three dialogs of the member page (/members/:id): changing the picture, the primary body
// and the primary email. The page itself is in members-single.spec.ts.
import path from 'node:path';

import type { Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { forbidden, notFound, ok } from '../support/factories/base.ts';
import { body, member, type Member } from '../support/factories/core.ts';
import { dialog, permissionsFor, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const PICTURE = path.join(import.meta.dirname, '../fixtures/core/picture.png');

// The value next to a label in the facts table of the page.
const fact = (page: Page, label: string) => page.getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: label, exact: true }) })
    .getByRole('cell');

const ANTENNA = body({ id: 1, name: 'AEGEE-Antenna', code: 'ANT' });
const OTHER = body({ id: 7, name: 'AEGEE-Brussels', code: 'BRU' });
const COMMISSION = body({ id: 8, name: 'Audit Commission', code: 'AUD', type: 'commission' });

const ALEX = (overrides: Partial<Member> = {}) => member({
    id: 42,
    username: 'alex.member',
    first_name: 'Alex',
    last_name: 'Member',
    email: 'alex@example.org',
    notification_email: 'alex@example.org',
    bodies: [ANTENNA],
    ...overrides
});

// Alex's page, seen by a global member manager.
const showMember = (api: ApiMock, me: Member | null, data: Member) => {
    api.on('GET core /members/:id', ({ params }) => ({ json: ok(params.id === 'me' ? me : data) }));
    permissionsFor(api, 'members', data.username, ['global:update:member']);
    for (const { id } of data.bodies) permissionsFor(api, 'bodies', id, []);
};

const memberLoads = (api: ApiMock) => api.callsTo('GET core /members/:id').filter((call) => call.params.id !== 'me').length;

test.describe('changing the picture', () => {
    test('uploads the chosen picture and shows the page again', async ({ page, api, me }) => {
        showMember(api, me, ALEX());
        api.json('POST core /members/:id/upload', { success: true, message: 'File uploaded successfully', data: 'alex.png' });
        await page.goto('/members/alex.member');

        await page.getByRole('button', { name: 'Change picture' }).click();
        const modal = dialog(page, 'Change picture');
        await expect(modal).toContainText('Not set.');
        // Nothing to upload or delete yet.
        await expect(modal.getByRole('button', { name: 'Upload' })).toBeDisabled();
        await expect(modal.getByRole('button', { name: 'Delete' })).toBeDisabled();

        await modal.getByLabel('Choose a picture').setInputFiles(PICTURE);
        await expect(modal).toContainText('picture.png');
        await modal.getByRole('button', { name: 'Upload' }).click();

        // The page is loaded again, with the new picture. (Its toast goes with the old page.)
        await expect.poll(() => memberLoads(api)).toBe(2);
        await expect(page.getByRole('heading', { name: 'Alex', level: 1 })).toBeVisible();
        await expect.poll(() => api.callsTo('POST core /members/:id/upload').map((call) => [call.params.id, call.parts.map(({ name, filename, contentType }) => ({ name, filename, contentType }))]))
            .toEqual([['42', [{ name: 'head_image', filename: 'picture.png', contentType: 'image/png' }]]]);
    });

    test('a refused upload says why and keeps the dialog open', async ({ page, api, me }) => {
        showMember(api, me, ALEX());
        api.on('POST core /members/:id/upload', { status: 422, json: { success: false, message: 'Malformed file content.' } });
        await page.goto('/members/alex.member');

        await page.getByRole('button', { name: 'Change picture' }).click();
        const modal = dialog(page, 'Change picture');
        await modal.getByLabel('Choose a picture').setInputFiles(PICTURE);
        await modal.getByRole('button', { name: 'Upload' }).click();

        await expect(toast(page, 'Could not update image: Malformed file content.')).toBeVisible();
        await expect(modal).toBeVisible();
        expect(memberLoads(api)).toBe(1);
    });

    test('deletes the picture and shows the page again', async ({ page, api, me }) => {
        showMember(api, me, ALEX({ image: 'alex.png' }));
        api.url('GET', '/media/core/headimages/*', { status: 404, json: { success: false, message: 'Not found' } });
        api.json('DELETE core /members/:id/image', { success: true, message: 'File removed successfully', data: null });
        await page.goto('/members/alex.member');

        await page.getByRole('button', { name: 'Change picture' }).click();
        const modal = dialog(page, 'Change picture');
        await expect(modal.getByRole('button', { name: 'Upload' })).toBeDisabled();
        await modal.getByRole('button', { name: 'Delete' }).click();

        // The page is loaded again, without the picture.
        await expect.poll(() => memberLoads(api)).toBe(2);
        await expect.poll(() => api.callsTo('DELETE core /members/:id/image').map((call) => call.params.id)).toEqual(['42']);
    });

    test('a picture that cannot be deleted stays, and the dialog closes with ×', async ({ page, api, me }) => {
        showMember(api, me, ALEX({ image: 'alex.png' }));
        api.url('GET', '/media/core/headimages/*', { status: 404, json: { success: false, message: 'Not found' } });
        api.on('DELETE core /members/:id/image', { status: 403, json: forbidden('Permission update:member is required, but not present.') });
        await page.goto('/members/alex.member');

        await page.getByRole('button', { name: 'Change picture' }).click();
        const modal = dialog(page, 'Change picture');
        await modal.getByRole('button', { name: 'Delete' }).click();

        await expect(toast(page, 'Could not remove image: Permission update:member is required, but not present.')).toBeVisible();
        await modal.getByRole('button', { name: 'Close' }).click();
        await expect(modal).toBeHidden();
        expect(memberLoads(api)).toBe(1);
    });
});

test.describe('setting the primary body', () => {
    const MANY = () => ALEX({ bodies: [OTHER, COMMISSION, ANTENNA], primary_body_id: 1, primary_body: ANTENNA });

    test('starts at the current primary body, lists the bodies by name and saves the new one', async ({ page, api, me }) => {
        showMember(api, me, MANY());
        api.json('PUT core /members/:id/primary-body', ok(MANY()));
        await page.goto('/members/alex.member');

        await page.getByRole('button', { name: 'Set primary body' }).click();
        const modal = dialog(page, 'Edit primary body');
        const select = modal.getByRole('combobox', { name: 'Primary body' });
        await expect(select).toHaveValue('1');
        await expect(select.getByRole('option')).toHaveText(['Not set', 'AEGEE-Antenna', 'AEGEE-Brussels', 'Audit Commission']);

        await select.selectOption({ label: 'AEGEE-Brussels' });
        await modal.getByRole('button', { name: 'Save changes' }).click();

        await expect(toast(page, 'Primary body is updated')).toBeVisible();
        await expect(modal).toBeHidden();
        await expect(fact(page, 'Primary body').getByRole('link', { name: 'AEGEE-Brussels' })).toHaveAttribute('href', '/bodies/7');
        const brussels = page.getByRole('row').filter({ has: page.getByRole('link', { name: 'BRU', exact: true }) });
        await expect(brussels).toContainText('Primary');
        await expect.poll(() => api.callsTo('PUT core /members/:id/primary-body').map((call) => [call.params.id, call.body])).toEqual([['42', { primary_body_id: 7 }]]);
    });

    test('a body that is no antenna is no primary body on the page', async ({ page, api, me }) => {
        showMember(api, me, MANY());
        api.json('PUT core /members/:id/primary-body', ok(MANY()));
        await page.goto('/members/alex.member');

        await page.getByRole('button', { name: 'Set primary body' }).click();
        const modal = dialog(page, 'Edit primary body');
        await modal.getByRole('combobox', { name: 'Primary body' }).selectOption({ label: 'Audit Commission' });
        await modal.getByRole('button', { name: 'Save changes' }).click();

        await expect(toast(page, 'Primary body is updated')).toBeVisible();
        await expect(fact(page, 'Primary body')).toHaveText('Not set.');
        await expect.poll(() => api.callsTo('PUT core /members/:id/primary-body').map((call) => call.body)).toEqual([{ primary_body_id: 8 }]);
    });

    test('"Not set" removes the primary body', async ({ page, api, me }) => {
        showMember(api, me, MANY());
        api.json('PUT core /members/:id/primary-body', ok(MANY()));
        await page.goto('/members/alex.member');

        await page.getByRole('button', { name: 'Set primary body' }).click();
        const modal = dialog(page, 'Edit primary body');
        await modal.getByRole('combobox', { name: 'Primary body' }).selectOption({ label: 'Not set' });
        await modal.getByRole('button', { name: 'Save changes' }).click();

        await expect(toast(page, 'Primary body is updated')).toBeVisible();
        await expect(fact(page, 'Primary body')).toHaveText('Not set.');
        await expect(page.getByText('Primary', { exact: true })).toHaveCount(0);
        await expect.poll(() => api.callsTo('PUT core /members/:id/primary-body').map((call) => call.body)).toEqual([{ primary_body_id: null }]);
    });

    test('a member without a primary body starts at "Not set"', async ({ page, api, me }) => {
        showMember(api, me, ALEX({ primary_body_id: null, primary_body: null }));
        await page.goto('/members/alex.member');

        await page.getByRole('button', { name: 'Set primary body' }).click();

        await expect(dialog(page, 'Edit primary body').getByRole('combobox', { name: 'Primary body' })).toHaveValue('');
    });

    test('a refused change keeps the dialog open; Cancel and × close it without saving', async ({ page, api, me }) => {
        showMember(api, me, MANY());
        api.on('PUT core /members/:id/primary-body', { status: 403, json: forbidden('User is not a member of this body.') });
        await page.goto('/members/alex.member');

        await page.getByRole('button', { name: 'Set primary body' }).click();
        const modal = dialog(page, 'Edit primary body');
        await modal.getByRole('combobox', { name: 'Primary body' }).selectOption({ label: 'AEGEE-Brussels' });
        await modal.getByRole('button', { name: 'Save changes' }).click();

        await expect(toast(page, 'Error updating primary body: User is not a member of this body.')).toBeVisible();
        await expect(modal).toBeVisible();
        await expect(fact(page, 'Primary body')).toHaveText('AEGEE-Antenna');

        await modal.getByRole('button', { name: 'Cancel' }).click();
        await expect(modal).toBeHidden();
        await page.getByRole('button', { name: 'Set primary body' }).click();
        await dialog(page, 'Edit primary body').getByRole('button', { name: 'Close' }).click();
        await expect(dialog(page, 'Edit primary body')).toBeHidden();
        await expect.poll(() => api.callsTo('PUT core /members/:id/primary-body')).toHaveLength(1);
    });
});

test.describe('setting the primary email', () => {
    const WITH_WORKSPACE = () => ALEX({ gsuite_id: 'example-alex@aegee.eu', primary_email: 'personal' });

    test('starts at the current choice and saves the other address', async ({ page, api, me }) => {
        showMember(api, me, WITH_WORKSPACE());
        api.json('PUT core /members/:id', ok(WITH_WORKSPACE()));
        await page.goto('/members/alex.member');

        await page.getByRole('button', { name: 'Set primary email' }).click();
        const modal = dialog(page, 'Set primary email');
        await expect(modal.getByRole('radio', { name: 'alex@example.org' })).toBeChecked();
        await expect(modal.getByRole('radio', { name: 'example-alex@aegee.eu' })).not.toBeChecked();

        await modal.getByText('example-alex@aegee.eu').click();
        await modal.getByRole('button', { name: 'Save changes' }).click();

        await expect(toast(page, 'Primary email is updated')).toBeVisible();
        await expect(modal).toBeHidden();
        await expect.poll(() => api.callsTo('PUT core /members/:id').map((call) => [call.params.id, call.body])).toEqual([['42', { primary_email: 'gsuite' }]]);

        // Opened again, it shows the new choice.
        await page.getByRole('button', { name: 'Set primary email' }).click();
        await expect(dialog(page, 'Set primary email').getByRole('radio', { name: 'example-alex@aegee.eu' })).toBeChecked();
    });

    test('explains what the primary email is', async ({ page, api, me }) => {
        showMember(api, me, WITH_WORKSPACE());
        await page.goto('/members/alex.member');

        await page.getByRole('button', { name: 'Set primary email' }).click();
        await dialog(page, 'Set primary email').getByRole('button', { name: 'More information' }).focus();

        await expect(page.getByRole('tooltip')).toHaveText('Your primary email is the place where you receive updates from MyAEGEE');
    });

    test('a refused change keeps the dialog open; Cancel closes it without saving', async ({ page, api, me }) => {
        showMember(api, me, ALEX({ gsuite_id: 'example-alex@aegee.eu', primary_email: 'gsuite' }));
        api.on('PUT core /members/:id', { status: 404, json: notFound('User is not found.') });
        await page.goto('/members/alex.member');

        await page.getByRole('button', { name: 'Set primary email' }).click();
        const modal = dialog(page, 'Set primary email');
        await expect(modal.getByRole('radio', { name: 'example-alex@aegee.eu' })).toBeChecked();
        await modal.getByRole('button', { name: 'Save changes' }).click();

        await expect(toast(page, 'Error updating primary email: User is not found.')).toBeVisible();
        await expect(modal).toBeVisible();
        await modal.getByRole('button', { name: 'Cancel' }).click();
        await expect(modal).toBeHidden();
        await expect.poll(() => api.callsTo('PUT core /members/:id').map((call) => call.body)).toEqual([{ primary_email: 'gsuite' }]);
    });
});
