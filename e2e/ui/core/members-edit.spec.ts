// Editing a member's profile (/members/:id/edit): the member themselves, or whoever may
// update members. The Google Workspace account is only for holders of global:update:member.
import type { Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { forbidden, notFound, ok, validationError } from '../support/factories/base.ts';
import { member, type Member } from '../support/factories/core.ts';
import { permissionsFor, toast } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { test, expect } from '../support/test.ts';

const field = (page: Page, label: string) => page.getByLabel(label, { exact: true });
const save = (page: Page) => page.getByRole('button', { name: 'Save user' });

// The member being edited, and what the viewer may do with them. `/members/me` is the route
// of the logged-in member too: it stays theirs.
const showMember = (api: ApiMock, me: Member | null, data: Member, permissions: string[] = []) => {
    api.on('GET core /members/:id', ({ params }) => {
        if (params.id === 'me') return { json: ok(me) };
        return params.id === data.username || params.id === String(data.id)
            ? { json: ok(data) }
            : { status: 404, json: notFound('User is not found.') };
    });
    permissionsFor(api, 'members', data.username, permissions);
};

const sent = (api: ApiMock) => api.callsTo('PUT core /members/:id').map((call) => [call.params.id, call.body]);

const ALEX = () => member({
    id: 42,
    username: 'alex.member',
    first_name: 'Alex',
    last_name: 'Member',
    phone: '+32 2 123 45 67',
    date_of_birth: '1999-05-01',
    gender: 'Female',
    address: 'Rue de la Loi 1',
    about_me: 'Likes trains'
});

test.describe('editing a member', () => {
    test('shows the member in the form, saves the changes and goes to the profile', async ({ page, api, me }) => {
        showMember(api, me, ALEX());
        api.on('PUT core /members/:id', { json: ok(ALEX()), delayMs: 500 });
        // The profile page that comes after, under the new username.
        api.on('GET core /members/:id', ({ params }) => ({ json: ok(params.id === 'me' ? me : member({ ...ALEX(), username: params.id })) }));
        permissionsFor(api, 'members', 'alex.new', []);
        permissionsFor(api, 'bodies', 1, []);

        await page.goto('/members/alex.member/edit');

        await expect(field(page, 'First name')).toHaveValue('Alex');
        await expect(field(page, 'Last name')).toHaveValue('Member');
        await expect(field(page, 'Username')).toHaveValue('alex.member');
        await expect(field(page, 'Phone')).toHaveValue('+32 2 123 45 67');
        await expect(field(page, 'Birthday')).toHaveValue('1999-05-01');
        await expect(field(page, 'Gender')).toHaveValue('Female');
        await expect(field(page, 'Address')).toHaveValue('Rue de la Loi 1');
        await expect(field(page, 'About me')).toHaveValue('Likes trains');
        // Only global member managers see the Google Workspace account.
        await expect(field(page, 'Google Workspace account')).toHaveCount(0);

        await field(page, 'Username').fill('alex.new');
        await field(page, 'Phone').fill('+32 2 765 43 21');
        await field(page, 'About me').fill('Likes boats');
        await save(page).click();

        await expect(save(page)).toBeDisabled();
        await expect(toast(page, 'User is saved.')).toBeVisible();
        await expect(page).toHaveURL('/members/alex.new');
        // Only the fields of the form, and no Workspace account.
        expect(sent(api)).toEqual([['alex.member', {
            id: 42,
            first_name: 'Alex',
            last_name: 'Member',
            username: 'alex.new',
            gender: 'Female',
            about_me: 'Likes boats',
            address: 'Rue de la Loi 1',
            phone: '+32 2 765 43 21',
            date_of_birth: '1999-05-01'
        }]]);
    });

    test('a typed birthday is sent as a date', async ({ page, api, me }) => {
        showMember(api, me, ALEX());
        api.json('PUT core /members/:id', ok(ALEX()));
        api.fallback(mockEverything);
        await page.goto('/members/alex.member/edit');
        await expect(field(page, 'Birthday')).toHaveValue('1999-05-01');

        await field(page, 'Birthday').fill('2000-02-29');
        await field(page, 'Birthday').blur();
        await save(page).click();

        await expect(toast(page, 'User is saved.')).toBeVisible();
        expect(sent(api).map(([, body]) => (body as Member).date_of_birth)).toEqual(['2000-02-29']);
    });

    test('a cleared birthday is sent as no birthday', async ({ page, api, me }) => {
        showMember(api, me, ALEX());
        api.json('PUT core /members/:id', ok(ALEX()));
        api.fallback(mockEverything);
        await page.goto('/members/alex.member/edit');
        await expect(field(page, 'Birthday')).toHaveValue('1999-05-01');

        await field(page, 'Birthday').fill('');
        await field(page, 'Birthday').blur();
        await save(page).click();

        await expect(toast(page, 'User is saved.')).toBeVisible();
        expect(sent(api).map(([, body]) => (body as Member).date_of_birth)).toEqual([null]);
    });

    test('a member without a birthday keeps an empty field', async ({ page, api, me }) => {
        showMember(api, me, member({ ...ALEX(), date_of_birth: null }));
        api.json('PUT core /members/:id', ok(ALEX()));
        api.fallback(mockEverything);
        await page.goto('/members/alex.member/edit');
        await expect(field(page, 'First name')).toHaveValue('Alex');

        await expect(field(page, 'Birthday')).toHaveValue('');
        await save(page).click();

        await expect(toast(page, 'User is saved.')).toBeVisible();
        expect(sent(api).map(([, body]) => (body as Member).date_of_birth)).toEqual([null]);
    });

    test('a global member manager sees and changes the Google Workspace account', async ({ page, api, me }) => {
        showMember(api, me, { ...ALEX(), gsuite_id: 'alex.member@aegee.eu' }, ['global:update:member']);
        api.json('PUT core /members/:id', ok(ALEX()));
        api.fallback(mockEverything);
        await page.goto('/members/alex.member/edit');

        await expect(field(page, 'Google Workspace account')).toHaveValue('alex.member@aegee.eu');
        await field(page, 'Google Workspace account').fill('alex.m@aegee.eu');
        await save(page).click();

        await expect(toast(page, 'User is saved.')).toBeVisible();
        expect(sent(api).map(([, body]) => (body as Member).gsuite_id)).toEqual(['alex.m@aegee.eu']);
    });

    test('a global member manager saves a member without a Google Workspace account', async ({ page, api, me }) => {
        showMember(api, me, { ...ALEX(), gsuite_id: null }, ['global:update:member']);
        api.json('PUT core /members/:id', ok(ALEX()));
        api.fallback(mockEverything);
        await page.goto('/members/alex.member/edit');
        await expect(field(page, 'Google Workspace account')).toHaveValue('');

        await field(page, 'About me').fill('Likes boats');
        await save(page).click();

        await expect(toast(page, 'User is saved.')).toBeVisible();
        expect(sent(api).map(([, body]) => (body as Member).gsuite_id)).toEqual([null]);
    });

    test('a global member manager removes the Google Workspace account', async ({ page, api, me }) => {
        showMember(api, me, { ...ALEX(), gsuite_id: 'alex.member@aegee.eu' }, ['global:update:member']);
        api.json('PUT core /members/:id', ok(ALEX()));
        api.fallback(mockEverything);
        await page.goto('/members/alex.member/edit');

        await field(page, 'Google Workspace account').fill('');
        await save(page).click();

        await expect(toast(page, 'User is saved.')).toBeVisible();
        expect(sent(api).map(([, body]) => (body as Member).gsuite_id)).toEqual([null]);
    });

    test('a custom gender is kept, and one of the list can be chosen', async ({ page, api, me }) => {
        showMember(api, me, member({ ...ALEX(), gender: 'Non-binary' }));
        api.json('PUT core /members/:id', ok(ALEX()));
        api.fallback(mockEverything);
        await page.goto('/members/alex.member/edit');

        await expect(field(page, 'Gender')).toHaveValue('custom');
        await expect(field(page, 'Gender (custom)')).toHaveValue('Non-binary');

        await field(page, 'Gender').selectOption('Male');
        await expect(field(page, 'Gender (custom)')).toBeHidden();
        await field(page, 'Gender').selectOption('custom');
        await field(page, 'Gender (custom)').fill('Agender');
        await save(page).click();

        await expect(toast(page, 'User is saved.')).toBeVisible();
        expect(sent(api).map(([, body]) => (body as Member).gender)).toEqual(['Agender']);
    });

    test('shows what the server says about each field', async ({ page, api, me }) => {
        showMember(api, me, ALEX());
        api.on('PUT core /members/:id', {
            status: 422,
            json: validationError({
                first_name: ['First name should be set.'],
                last_name: ['Last name should be set.'],
                username: ['Username should have at least 1 letter.'],
                date_of_birth: ['Birthday should be in the past.']
            })
        });
        await page.goto('/members/alex.member/edit');
        await expect(field(page, 'First name')).toHaveValue('Alex');

        await save(page).click();

        await expect(toast(page, 'Some of the user data is invalid.')).toBeVisible();
        for (const message of ['First name should be set.', 'Last name should be set.', 'Username should have at least 1 letter.', 'Birthday should be in the past.']) {
            await expect(page.getByText(message, { exact: true })).toBeVisible();
        }
        await expect(page).toHaveURL('/members/alex.member/edit');
        await expect(save(page)).toBeEnabled();
    });

    test('shows the Workspace account\'s error to a global member manager', async ({ page, api, me }) => {
        showMember(api, me, { ...ALEX(), gsuite_id: 'alex.member@aegee.eu' }, ['global:update:member']);
        api.on('PUT core /members/:id', { status: 422, json: validationError({ gsuite_id: ['GSuite ID should be a valid email.'] }) });
        await page.goto('/members/alex.member/edit');
        await expect(field(page, 'Google Workspace account')).toHaveValue('alex.member@aegee.eu');

        await save(page).click();

        await expect(page.getByText('GSuite ID should be a valid email.', { exact: true })).toBeVisible();
    });

    test('shows the server message when saving is not allowed', async ({ page, api, me }) => {
        showMember(api, me, ALEX());
        api.on('PUT core /members/:id', { status: 403, json: forbidden('Permission update:member is required, but not present.') });
        await page.goto('/members/alex.member/edit');
        await expect(field(page, 'First name')).toHaveValue('Alex');

        await save(page).click();

        await expect(toast(page, 'Could not save user: Permission update:member is required, but not present.')).toBeVisible();
        await expect(page).toHaveURL('/members/alex.member/edit');
    });

    test('an unknown member goes back to the members list', async ({ page, api, me }) => {
        api.on('GET core /members/:id', ({ params }) => (params.id === 'me' ? { json: ok(me) } : { status: 404, json: notFound('User is not found.') }));
        api.fallback(mockEverything);

        await page.goto('/members/nobody/edit');

        await expect(toast(page, 'User is not found')).toBeVisible();
        await expect(page).toHaveURL('/members');
    });

    test('goes back to the members list when the permissions cannot be loaded', async ({ page, api, me }) => {
        api.on('GET core /members/:id', ({ params }) => ({ json: ok(params.id === 'me' ? me : ALEX()) }));
        api.on('GET core /members/:id/my_permissions', { status: 500, json: { success: false, message: 'Something went wrong on the server.' } });
        api.fallback(mockEverything);

        await page.goto('/members/alex.member/edit');

        await expect(toast(page, 'Some error happened: Something went wrong on the server.')).toBeVisible();
        await expect(page).toHaveURL('/members');
    });
});
