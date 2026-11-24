// Creating a member for a body (/bodies/:id/new_member): someone who has no account yet.
import type { Page } from '@playwright/test';

import { forbidden, ok, validationError } from '../support/factories/base.ts';
import { bodyDetail } from '../support/factories/core-bodies.ts';
import { permissionsFor, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const save = (page: Page) => page.getByRole('button', { name: 'Save user' });

const fillRequired = async (page: Page): Promise<void> => {
    await page.getByLabel('First name').fill('Jane');
    await page.getByLabel('Last name').fill('Doe');
    await page.getByLabel('Email').fill('jane@example.com');
    await page.getByLabel('Username').fill('jane.doe');
};

test.describe('creating a member for a body', () => {
    test('explains the form and sends nothing without the required fields', async ({ page, api, consoleErrors }) => {
        await page.goto('/bodies/1/new_member');

        await expect(page.getByRole('heading', { name: 'Create member' })).toBeVisible();
        await expect(page).toHaveTitle('MyAEGEE | Create a member for body');
        await expect(page.getByText('This form is only for creating members that are not yet signed up to a system. If you want to add an existing member to your body, go back to the body page and press \'Add member\'!')).toBeVisible();
        await save(page).click();

        await expect(page.getByLabel('First name')).toHaveJSProperty('validity.valueMissing', true);
        await page.getByLabel('First name').fill('Jane');
        await page.getByLabel('Last name').fill('Doe');
        await page.getByLabel('Email').fill('not an email');
        await page.getByLabel('Username').fill('jane.doe');
        await save(page).click();
        await expect(page.getByLabel('Email')).toHaveJSProperty('validity.typeMismatch', true);
        expect(api.callsTo('POST core /bodies/:id/create-member')).toHaveLength(0);
        // Every icon of the form exists.
        expect(consoleErrors).toEqual([]);
    });

    test('creates the member with all fields and opens the members of the body', async ({ page, api }) => {
        api.json('POST core /bodies/:id/create-member', ok({ id: 77 }));
        api.json('GET core /bodies/:id', ok(bodyDetail({ id: 1 })));
        api.json('GET core /bodies/:id/members', ok([]));
        permissionsFor(api, 'bodies', 1, []);

        await page.goto('/bodies/1/new_member');
        await fillRequired(page);
        await page.getByLabel('Phone').fill('+32 2 123 45 67');
        await page.getByLabel('Birthday').fill('1990-05-14');
        await page.getByLabel('Birthday').blur();
        await page.getByLabel('Gender').fill('female');
        await page.getByLabel('Address').fill('Main street 1');
        await page.getByLabel('About me').fill('Joined at the fair');
        await save(page).click();

        await expect(toast(page, 'User is created.')).toBeVisible();
        await expect(page).toHaveURL('/bodies/1/members');
        await expect.poll(() => api.callsTo('POST core /bodies/:id/create-member').map((call) => [call.params, call.body])).toEqual([[{ id: '1' }, {
            first_name: 'Jane',
            last_name: 'Doe',
            date_of_birth: '1990-05-14',
            gender: 'female',
            phone: '+32 2 123 45 67',
            address: 'Main street 1',
            username: 'jane.doe',
            email: 'jane@example.com',
            about_me: 'Joined at the fair'
        }]]);
    });

    test('without a birthday sends an empty one', async ({ page, api }) => {
        api.on('POST core /bodies/:id/create-member', { status: 500, json: { success: false, message: 'Something went wrong on the server.' } });

        await page.goto('/bodies/1/new_member');
        await fillRequired(page);
        // A birthday typed and removed again counts as none.
        await page.getByLabel('Birthday').fill('1990-05-14');
        await page.getByLabel('Birthday').blur();
        await page.getByLabel('Birthday').fill('');
        await page.getByLabel('Birthday').blur();
        await save(page).click();

        await expect(toast(page, 'Could not create user: Something went wrong on the server.')).toBeVisible();
        await expect.poll(() => api.callsTo('POST core /bodies/:id/create-member')[0].body).toMatchObject({ date_of_birth: '' });
    });

    test('cannot be sent twice while saving', async ({ page, api }) => {
        api.on('POST core /bodies/:id/create-member', { status: 403, json: forbidden('Permission create_member:body is required, but not present.'), delayMs: 1000 });

        await page.goto('/bodies/1/new_member');
        await fillRequired(page);
        await save(page).click();

        await expect(save(page)).toBeDisabled();
        await expect(toast(page, 'Could not create user: Permission create_member:body is required, but not present.')).toBeVisible();
        await expect(save(page)).toBeEnabled();
        await expect(page).toHaveURL('/bodies/1/new_member');
    });

    test('shows what the service objects to under the fields', async ({ page, api }) => {
        api.on('POST core /bodies/:id/create-member', {
            status: 422,
            json: validationError({
                first_name: ['First name should be set.'],
                last_name: ['Last name should be set.'],
                email: ['Email should be valid.'],
                username: ['Username should only contain letters, numbers, dots, underscores and dashes.'],
                date_of_birth: ['Birthday should be in the past.']
            })
        });

        await page.goto('/bodies/1/new_member');
        await fillRequired(page);
        await save(page).click();

        await expect(toast(page, 'Some of the user data is invalid.')).toBeVisible();
        await expect(page.getByText('Email should be valid.')).toBeVisible();
        await expect(page.getByText('Username should only contain letters, numbers, dots, underscores and dashes.')).toBeVisible();
        await expect(page.getByText('Birthday should be in the past.')).toBeVisible();
        for (const message of ['First name should be set.', 'Last name should be set.']) {
            await expect(page.getByText(message), message).toBeVisible();
        }
    });
});

test.describe('creating a member for a visitor', () => {
    test.use({ session: 'anonymous' });

    test('sends the visitor to the login page first', async ({ page }) => {
        await page.goto('/bodies/1/new_member');

        await expect(page).toHaveURL('/login?to=%2Fbodies%2F1%2Fnew_member');
    });
});
