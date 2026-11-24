// Completing the profile (/profile/update): every page sends a member whose profile is not
// complete here (no privacy consent, a username of digits only, a login email on an AEGEE
// domain, or no local), and the page asks for what is missing.
import type { Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { ok, validationError } from '../support/factories/base.ts';
import { body, type Body } from '../support/factories/core.ts';
import { dialog, freezeTime, toast } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { test, expect } from '../support/test.ts';

const ANTENNA = body({ id: 1, name: 'AEGEE-Antenna', type: 'antenna', email: 'board@antenna.example.org', website: 'https://antenna.example.org' });
const CONTACT = body({ id: 2, name: 'AEGEE-Contact <Town>', type: 'contact', email: 'contact@example.org', website: null });
const BODIES: Body[] = [
    ANTENNA,
    CONTACT,
    body({ id: 3, name: 'AEGEE-Contact Antenna', type: 'contact antenna' }),
    body({ id: 4, name: 'Les Anciens', type: 'external' }),
    body({ id: 5, name: 'Secretariat', type: 'other' }),
    body({ id: 6, name: 'Audit Commission', type: 'commission' }),
    body({ id: 7, name: 'IT Committee', type: 'committee' }),
    body({ id: 8, name: 'Erasmus WG', type: 'working group' })
];

const showBodies = (api: ApiMock, bodies: Body[] = BODIES) => api.json('GET core /bodies', ok(bodies));
const save = (page: Page) => page.getByRole('button', { name: 'Save user' });
const issues = (page: Page) => page.getByText('Your profile has the following issues and you have to fix them before using the system:');
const saved = (api: ApiMock) => api.callsTo('PUT core /members/:id').map((call) => [call.params.id, call.body]);

test.describe('completing the profile', () => {
    test('a member without privacy consent is sent here, agrees and goes on', async ({ page, api, me }) => {
        await freezeTime(page);
        me!.privacy_consent = null;
        showBodies(api);
        api.on('PUT core /members/:id', () => {
            me!.privacy_consent = '2027-03-01T09:00:00.000Z';
            return { json: ok(me) };
        });
        api.fallback(mockEverything);

        await page.goto('/dashboard');

        await expect(page).toHaveURL('/profile/update');
        await expect(issues(page)).toBeVisible();
        await expect(page.getByRole('main').getByRole('listitem')).toHaveText(['You should agree to the Privacy Policy.']);
        const policy = page.getByRole('link', { name: 'Privacy Policy' });
        await expect(policy).toHaveAttribute('href', '/pages/terms-of-service');
        await expect(policy).toHaveAttribute('target', '_blank');
        // Only what is missing is asked for.
        await expect(page.getByLabel('Username')).toHaveCount(0);
        await expect(page.getByLabel('Email')).toHaveCount(0);
        await expect(page.getByLabel(/^Body/)).toHaveCount(0);
        await expect(page.getByRole('form', { name: 'Your profile' })).toHaveAttribute('aria-busy', 'false');

        await page.getByRole('checkbox', { name: /I agree to the/ }).check();
        await save(page).click();

        // The page is loaded again and sends the member on.
        await expect(page).toHaveURL('/dashboard');
        expect(saved(api)).toEqual([['me', {
            id: me!.id,
            first_name: me!.first_name,
            last_name: me!.last_name,
            username: me!.username,
            gender: me!.gender,
            about_me: me!.about_me,
            address: me!.address,
            phone: me!.phone,
            date_of_birth: me!.date_of_birth,
            // The moment of agreeing: the frozen clock runs on from 10:00.
            privacy_consent: expect.stringMatching(/^2027-03-01T10:0\d:\d\d\+01:00$/)
        }]]);
    });

    test('does not save without the consent', async ({ page, api, me }) => {
        me!.privacy_consent = null;
        showBodies(api);
        await page.goto('/profile/update');

        await save(page).click();

        await expect(toast(page, 'You should agree to the Privacy Policy.')).toBeVisible();
        expect(saved(api)).toEqual([]);
    });

    test('a username of digits only has to be changed', async ({ page, api, me }) => {
        me!.username = '12345';
        showBodies(api);
        api.on('PUT core /members/:id', () => ({ json: ok(me) }));
        api.fallback(mockEverything);
        await page.goto('/profile/update');

        await expect(page.getByRole('main').getByRole('listitem')).toHaveText(['Your username cannot consist of numbers only.']);
        const username = page.getByLabel('Username');
        await expect(username).toHaveValue('12345');
        await expect(page.getByRole('checkbox', { name: /I agree to the/ })).toHaveCount(0);

        // The browser refuses it.
        await save(page).click();
        expect(await username.evaluate((input: HTMLInputElement) => input.validity.patternMismatch)).toBe(true);
        expect(saved(api)).toEqual([]);

        await username.fill('alex.m');
        me!.username = 'alex.m';
        await save(page).click();

        await expect(page).toHaveURL('/dashboard');
        expect(saved(api).map(([, sent]) => (sent as { username: string }).username)).toEqual(['alex.m']);
    });

    test('shows why the server refused the username', async ({ page, api, me }) => {
        me!.username = '12345';
        showBodies(api);
        api.on('PUT core /members/:id', { status: 422, json: validationError({ username: ['username must be unique'] }) });
        await page.goto('/profile/update');

        await page.getByLabel('Username').fill('taken');
        await save(page).click();

        await expect(toast(page, 'Some of the user data is invalid.')).toBeVisible();
        await expect(page.getByText('username must be unique', { exact: true })).toBeVisible();
        await expect(page).toHaveURL('/profile/update');
        await expect(save(page)).toBeEnabled();
    });

    test('shows the server message when saving fails otherwise', async ({ page, api, me }) => {
        me!.privacy_consent = null;
        showBodies(api);
        api.on('PUT core /members/:id', { status: 500, json: { success: false, message: 'Something went wrong on the server.' } });
        await page.goto('/profile/update');

        await page.getByRole('checkbox', { name: /I agree to the/ }).check();
        await save(page).click();

        await expect(toast(page, 'Could not save user: Something went wrong on the server.')).toBeVisible();
        await expect(page).toHaveURL('/profile/update');
    });

    test('a login email on an AEGEE domain has to be changed to another address', async ({ page, api, me }) => {
        me!.email = 'alex@aegee.org';
        showBodies(api);
        api.json('PUT core /members/:id/email', {
            success: true,
            message: 'The email change was requested. It takes effect after it is confirmed from the new address.',
            data: { needs_old_address_confirmation: false }
        });
        await page.goto('/profile/update');

        await expect(page.getByRole('main').getByRole('listitem')).toHaveText(['Your email can not be in one of the following domains: aegee.org, aegee.eu.']);
        await expect(save(page)).toHaveCount(0);
        const email = page.getByLabel('Email');

        // Not to another AEGEE address, nor one of their subdomains.
        for (const address of ['alex@aegee.eu', 'alex@lists.aegee.org']) {
            await email.fill(address);
            await page.getByRole('button', { name: 'Change email' }).click();
        }
        await expect(toast(page, 'Your email can not be in one of the following domains: aegee.org, aegee.eu.')).toHaveCount(2);
        expect(api.callsTo('PUT core /members/:id/email')).toHaveLength(0);

        await email.fill('alex@example.org');
        await page.getByRole('button', { name: 'Change email' }).click();

        await expect(toast(page, 'An email change is triggered. Check your new inbox for a confirmation.')).toBeVisible();
        await expect.poll(() => api.callsTo('PUT core /members/:id/email').map((call) => [call.params.id, call.body])).toEqual([['me', { new_email: 'alex@example.org' }]]);
    });

    test('a refused email change says why', async ({ page, api, me }) => {
        me!.email = 'alex@aegee.org';
        showBodies(api);
        api.on('PUT core /members/:id/email', { status: 422, json: { success: false, message: 'User with this email already exists.' } });
        await page.goto('/profile/update');

        await page.getByLabel('Email').fill('taken@example.org');
        await page.getByRole('button', { name: 'Change email' }).click();

        await expect(toast(page, 'Error changing user email: User with this email already exists.')).toBeVisible();
    });

    test.describe('without a local', () => {
        test('chooses among the locals and sends a join request with a motivation', async ({ page, api, me }) => {
            me!.bodies = [];
            showBodies(api);
            api.json('POST core /bodies/:id/join-requests', ok({ id: 9, body_id: 1, user_id: me!.id, status: 'pending', motivation: 'I like it' }));
            await page.goto('/profile/update');

            await expect(page.getByRole('main').getByRole('listitem')).toHaveText(['You should be a member of at least 1 local.']);
            const select = page.getByRole('combobox', { name: /^Body/ });
            // Only locals and the bodies anyone may join.
            await expect(select.getByRole('option')).toHaveText(['AEGEE-Antenna', 'AEGEE-Contact <Town>', 'AEGEE-Contact Antenna', 'Les Anciens', 'Secretariat']);
            await expect(page.getByRole('link', { name: 'This toolkit' })).toHaveAttribute('target', '_blank');
            await expect(page.getByRole('link', { name: 'network@aegee.eu' })).toHaveAttribute('href', 'mailto:network@aegee.eu');

            await select.selectOption({ label: 'AEGEE-Antenna' });
            await page.getByRole('button', { name: 'Join body' }).click();
            const prompt = dialog(page, 'Join body');
            await expect(prompt).toContainText('we strongly encourage you to also contact the Local board directly by email');
            await expect(prompt).toContainText('Local email: board@antenna.example.org');
            await expect(prompt).toContainText('Website: https://antenna.example.org');
            await prompt.getByRole('textbox', { name: 'Motivation' }).fill('I like it');
            await prompt.getByRole('button', { name: 'OK' }).click();

            await expect(toast(page, 'Join request is sent. Please wait until a board members accepts it.')).toBeVisible();
            await expect.poll(() => api.callsTo('POST core /bodies/:id/join-requests').map((call) => [call.params.id, call.body])).toEqual([['1', { motivation: 'I like it' }]]);
            // The member is still asked for a local until the board accepts, and is told so.
            await expect(page.getByRole('status').filter({ hasText: 'Your request to join AEGEE-Antenna is waiting for its board' })).toBeVisible();
            await expect(page.getByRole('main').getByRole('listitem')).toHaveText(['You should be a member of at least 1 local.']);
        });

        test('the prompt shows only the email of a local without a website, as text', async ({ page, api, me }) => {
            me!.bodies = [];
            showBodies(api);
            api.json('POST core /bodies/:id/join-requests', ok({ id: 9, body_id: 2, user_id: me!.id, status: 'pending', motivation: null }));
            await page.goto('/profile/update');

            await page.getByRole('combobox', { name: /^Body/ }).selectOption({ label: 'AEGEE-Contact <Town>' });
            await page.getByRole('button', { name: 'Join body' }).click();
            const prompt = dialog(page, 'Join body');
            await expect(prompt).toContainText('Local email: contact@example.org');
            await expect(prompt).not.toContainText('Website:');
            await prompt.getByRole('button', { name: 'OK' }).click();

            await expect(toast(page, 'Join request is sent. Please wait until a board members accepts it.')).toBeVisible();
            // Without a motivation it is empty.
            await expect.poll(() => api.callsTo('POST core /bodies/:id/join-requests').map((call) => [call.params.id, call.body])).toEqual([['2', { motivation: '' }]]);
        });

        test('a pending join request is mentioned when the page opens', async ({ page, api, me }) => {
            me!.bodies = [];
            me!.join_requests = [{ id: 9, body_id: 1, user_id: me!.id, status: 'pending', motivation: 'I like it' }];
            showBodies(api);

            await page.goto('/profile/update');

            await expect(page.getByRole('status').filter({ hasText: 'Your request to join AEGEE-Antenna is waiting for its board' })).toBeVisible();
        });

        test('a pending join request to a body that is gone is mentioned too', async ({ page, api, me }) => {
            me!.bodies = [];
            me!.join_requests = [{ id: 9, body_id: 99, user_id: me!.id, status: 'pending', motivation: null }, { id: 10, body_id: 1, user_id: me!.id, status: 'approved', motivation: null }];
            showBodies(api);

            await page.goto('/profile/update');

            await expect(page.getByRole('status').filter({ hasText: 'Your request to join' })).toHaveText(/^\s*Your request to join a body is waiting for its board\./);
        });

        test('Join body waits for a choice', async ({ page, api, me }) => {
            me!.bodies = [];
            showBodies(api);
            await page.goto('/profile/update');

            const join = page.getByRole('button', { name: 'Join body' });
            await expect(join).toBeDisabled();
            await page.getByRole('combobox', { name: /^Body/ }).selectOption({ label: 'Les Anciens' });
            await expect(join).toBeEnabled();
        });

        test('explains what to choose', async ({ page, api, me }) => {
            me!.bodies = [];
            showBodies(api);
            await page.goto('/profile/update');

            await page.getByRole('button', { name: 'More information' }).focus();

            await expect(page.getByRole('tooltip')).toHaveText('Choose the local you want to join. Its board accepts you as a member.');
        });

        test('a second request to the same local says so', async ({ page, api, me }) => {
            me!.bodies = [];
            showBodies(api);
            api.on('POST core /bodies/:id/join-requests', { status: 422, json: validationError({ body_id: ['body_id must be unique'], user_id: ['user_id must be unique'] }) });
            await page.goto('/profile/update');

            await page.getByRole('combobox', { name: /^Body/ }).selectOption({ label: 'AEGEE-Antenna' });
            await page.getByRole('button', { name: 'Join body' }).click();
            await dialog(page, 'Join body').getByRole('button', { name: 'OK' }).click();

            await expect(toast(page, 'You\'ve already requested to join this body.')).toBeVisible();
        });

        test('a join request that fails otherwise shows the server message', async ({ page, api, me }) => {
            me!.bodies = [];
            showBodies(api);
            api.on('POST core /bodies/:id/join-requests', { status: 500, json: { success: false, message: 'Something went wrong on the server.' } });
            await page.goto('/profile/update');

            await page.getByRole('combobox', { name: /^Body/ }).selectOption({ label: 'AEGEE-Antenna' });
            await page.getByRole('button', { name: 'Join body' }).click();
            await dialog(page, 'Join body').getByRole('button', { name: 'OK' }).click();

            await expect(toast(page, 'Could not send join request: Something went wrong on the server.')).toBeVisible();
            await expect(page.getByRole('status').filter({ hasText: 'Your request to join' })).toHaveCount(0);
        });
    });

    test('a complete profile is sent to the dashboard', async ({ page, api }) => {
        api.fallback(mockEverything);

        await page.goto('/profile/update');

        await expect(page).toHaveURL('/dashboard');
        expect(api.callsTo('GET core /bodies')).toHaveLength(0);
    });

    test('a superadmin is never asked to complete the profile', async ({ page, api, me }) => {
        me!.superadmin = true;
        me!.privacy_consent = null;
        me!.email = 'admin@aegee.org';
        api.fallback(mockEverything);

        await page.goto('/dashboard');

        await expect(page.getByRole('main').getByRole('heading').first()).toHaveText(/\S/);
        await expect(page).toHaveURL('/dashboard');
    });

    test('says so when the own profile is not found', async ({ page, api, me }) => {
        me!.privacy_consent = null;
        // The app knows who is logged in; the page's own request for it finds nobody.
        let asked = 0;
        api.on('GET core /members/me', () => {
            asked += 1;
            return asked === 1 ? { json: ok(me) } : { status: 404, json: { success: false, message: 'User is not found.' } };
        });

        await page.goto('/profile/update');

        await expect(toast(page, 'User is not found')).toBeVisible();
        await expect(page.getByRole('form', { name: 'Your profile' })).toHaveAttribute('aria-busy', 'false');
    });

    test('the form can still be used when the bodies cannot be loaded', async ({ page, api, me }) => {
        me!.privacy_consent = null;
        api.on('GET core /bodies', { status: 500, json: { success: false, message: 'Something went wrong on the server.' } });
        api.on('PUT core /members/:id', { status: 500, json: { success: false, message: 'Something went wrong on the server.' } });
        await page.goto('/profile/update');

        await expect(toast(page, 'Some error happened: Something went wrong on the server.')).toBeVisible();
        await expect(page.getByRole('form', { name: 'Your profile' })).toHaveAttribute('aria-busy', 'false');
        await page.getByRole('checkbox', { name: /I agree to the/ }).check();
        await save(page).click();
        await expect(toast(page, 'Could not save user: Something went wrong on the server.')).toBeVisible();
    });
});
