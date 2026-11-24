// The signup page (/signup/:campaign): what the campaign says, the form, what is sent to core,
// and core's answers. The menu's "Register" opens the default campaign, which joins no body.
import type { Page } from '@playwright/test';

import { signedUpMember } from '../support/factories/auth.ts';
import { forbidden, notFound, ok, validationError } from '../support/factories/base.ts';
import { publicCampaign } from '../support/factories/core.ts';
import { freezeTime, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const DEFAULT_CAMPAIGN = publicCampaign({ id: 1, url: 'default', name: 'Default campaign', description_long: 'Join **AEGEE**', autojoin_body: null });
const ANTENNA_CAMPAIGN = publicCampaign({
    id: 2,
    url: 'antenna-fair',
    name: 'Fair of AEGEE-Antenna',
    description_long: 'Meet us at the **fair** and [read more](https://www.example.org/fair).',
    autojoin_body: { id: 1, name: 'AEGEE-Antenna', email: 'board@antenna.example.org', phone: null, address: 'Somewhere in Europe', website: null }
});

// Everything the form needs before core is asked.
const fillRequired = async (page: Page): Promise<void> => {
    await page.getByLabel('Username').fill('nora.newcomer');
    await page.getByLabel('Email').fill('nora@example.org');
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill('5ecr3t5ecr3t');
    await page.getByLabel('Password confirmation').fill('5ecr3t5ecr3t');
    await page.getByLabel('First name').fill('Nora');
    await page.getByLabel('Last name').fill('Newcomer');
    await page.getByRole('checkbox', { name: /I agree to the Privacy Policy/ }).check();
};

const register = (page: Page) => page.getByRole('button', { name: 'Register', exact: true }).click();

test.describe('signup page', () => {
    test.use({ session: 'anonymous' });

    test('the default campaign explains that no local is joined yet, and links to the privacy policy and the login', async ({ page, api }) => {
        api.json('GET core /campaigns/:id', ok(DEFAULT_CAMPAIGN));

        await page.goto('/signup/default');

        await expect(page.getByRole('heading', { name: 'Register on MyAEGEE', exact: true })).toBeVisible();
        await expect(page.getByText('You will not become a member of a local yet')).toBeVisible();
        await expect(page.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/pages/terms-of-service');
        await expect(page.getByRole('main').getByRole('link', { name: 'Login', exact: true })).toHaveAttribute('href', '/login');
        await expect(page).toHaveTitle('MyAEGEE | Register');
        expect(api.callsTo('GET core /campaigns/:id').map((call) => call.params)).toEqual([{ id: 'default' }]);
    });

    test('a campaign of a body names the body, shows its description and how to reach the body', async ({ page, api }) => {
        api.json('GET core /campaigns/:id', ok(ANTENNA_CAMPAIGN));

        await page.goto('/signup/antenna-fair');

        await expect(page.getByRole('heading', { name: 'Register on MyAEGEE for AEGEE-Antenna' })).toBeVisible();
        await expect(page.getByText('automatically become a member of AEGEE-Antenna after you have confirmed your email')).toBeVisible();
        await expect(page.getByRole('strong').filter({ hasText: 'fair' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'read more' })).toHaveAttribute('href', 'https://www.example.org/fair');
        await expect(page.getByText('If you have any questions, you can contact AEGEE-Antenna at board@antenna.example.org.')).toBeVisible();
        await expect(page.getByText('You will not become a member of a local yet')).toHaveCount(0);
    });

    test('without an address of the body there is no sentence about contacting it', async ({ page, api }) => {
        api.json('GET core /campaigns/:id', ok({ ...ANTENNA_CAMPAIGN, autojoin_body: { ...ANTENNA_CAMPAIGN.autojoin_body!, email: '' } }));

        await page.goto('/signup/antenna-fair');

        await expect(page.getByRole('heading', { name: 'Register on MyAEGEE for AEGEE-Antenna' })).toBeVisible();
        await expect(page.getByText(/If you have any questions/)).toHaveCount(0);
    });

    test('signing up with every field sends them and goes on to the confirmation page', async ({ page, api }) => {
        await freezeTime(page);
        api.json('GET core /campaigns/:id', ok(ANTENNA_CAMPAIGN));
        api.json('POST core /signup/:id', ok(signedUpMember()));
        await page.goto('/signup/antenna-fair');

        await fillRequired(page);
        await page.getByLabel('Phone').fill('+32 000 00 00 00');
        await page.getByLabel('Birthday').fill('1999-05-01');
        await page.getByLabel('Birthday').blur();
        await page.getByLabel('Gender', { exact: true }).selectOption('Female');
        await page.getByLabel('Address').fill('Rue de la Loi 1, Brussels');
        await page.getByLabel('About me').fill('Likes travelling');
        await register(page);

        await expect(toast(page, 'Your submission is registered.')).toBeVisible();
        await expect(page).toHaveURL('/confirm_signup');
        const [call] = api.callsTo('POST core /signup/:id');
        expect(call.params).toEqual({ id: 'antenna-fair' });
        const { privacy_consent: consent, ...sent } = call.body as Record<string, unknown>;
        expect(sent).toEqual({
            username: 'nora.newcomer',
            password: '5ecr3t5ecr3t',
            first_name: 'Nora',
            last_name: 'Newcomer',
            email: 'nora@example.org',
            date_of_birth: '1999-05-01',
            gender: 'Female',
            phone: '+32 000 00 00 00',
            address: 'Rue de la Loi 1, Brussels',
            about_me: 'Likes travelling'
        });
        // The moment of signing up, in the time zone of the browser.
        expect(consent).toMatch(/^2027-03-01T10:0\d:\d\d\+01:00$/);
    });

    test('only the required fields: the others are sent empty', async ({ page, api }) => {
        api.json('GET core /campaigns/:id', ok(DEFAULT_CAMPAIGN));
        api.json('POST core /signup/:id', ok(signedUpMember()));
        await page.goto('/signup/default');

        await fillRequired(page);
        await register(page);

        await expect(page).toHaveURL('/confirm_signup');
        expect(api.callsTo('POST core /signup/:id').map((call) => call.body)).toEqual([expect.objectContaining({
            date_of_birth: null, gender: null, phone: null, address: null, about_me: null
        })]);
    });

    test('a birthday that is typed and then removed is sent as none', async ({ page, api }) => {
        api.json('GET core /campaigns/:id', ok(DEFAULT_CAMPAIGN));
        api.json('POST core /signup/:id', ok(signedUpMember()));
        await page.goto('/signup/default');

        await fillRequired(page);
        await page.getByLabel('Birthday').fill('1999-05-01');
        await page.getByLabel('Birthday').blur();
        await page.getByLabel('Birthday').fill('');
        await page.getByLabel('Birthday').blur();
        await register(page);

        await expect(page).toHaveURL('/confirm_signup');
        expect(api.callsTo('POST core /signup/:id').map((call) => (call.body as Record<string, unknown>).date_of_birth)).toEqual([null]);
    });

    test('a gender of one\'s own is typed into a field that only "Custom..." shows', async ({ page, api }) => {
        api.json('GET core /campaigns/:id', ok(DEFAULT_CAMPAIGN));
        api.json('POST core /signup/:id', ok(signedUpMember()));
        await page.goto('/signup/default');
        const gender = page.getByLabel('Gender', { exact: true });
        const custom = page.getByLabel('Gender (custom)');

        await expect(gender).toHaveValue('');
        await expect(custom).toBeHidden();
        await gender.selectOption('Male');
        await expect(custom).toBeHidden();
        await gender.selectOption('Custom...');
        await custom.fill('Non-binary');

        await fillRequired(page);
        await register(page);

        await expect(page).toHaveURL('/confirm_signup');
        expect(api.callsTo('POST core /signup/:id').map((call) => (call.body as Record<string, unknown>).gender)).toEqual(['Non-binary']);
    });

    test('two different passwords are caught before sending', async ({ page, api }) => {
        api.json('GET core /campaigns/:id', ok(DEFAULT_CAMPAIGN));
        await page.goto('/signup/default');

        await fillRequired(page);
        await page.getByLabel('Password confirmation').fill('another-password');
        await register(page);

        await expect(page.getByText('Passwords do not match.')).toBeVisible();
        expect(api.callsTo('POST core /signup/:id')).toEqual([]);
    });

    test('the browser doesn\'t send a username of digits, a short password, a wrong address or a form without consent', async ({ page, api }) => {
        api.json('GET core /campaigns/:id', ok(DEFAULT_CAMPAIGN));
        await page.goto('/signup/default');
        await fillRequired(page);
        const invalid = (label: string, check: 'patternMismatch' | 'tooShort' | 'typeMismatch' | 'valueMissing') => page.getByRole('textbox', { name: label, exact: true })
            .evaluate((input: HTMLInputElement, which) => input.validity[which], check);

        await page.getByLabel('Username').fill('12345');
        await register(page);
        expect(await invalid('Username', 'patternMismatch')).toBe(true);
        await expect(page.getByLabel('Username')).toHaveAttribute('title', /should contain at least 1 letter/);
        await page.getByLabel('Username').fill('nora.newcomer');

        await page.getByRole('textbox', { name: 'Password', exact: true }).fill('short');
        await register(page);
        expect(await invalid('Password', 'tooShort')).toBe(true);
        await page.getByRole('textbox', { name: 'Password', exact: true }).fill('5ecr3t5ecr3t');

        await page.getByLabel('Email').fill('nora at example.org');
        await register(page);
        expect(await invalid('Email', 'typeMismatch')).toBe(true);
        await page.getByLabel('Email').fill('nora@example.org');

        await page.getByRole('checkbox', { name: /I agree to the Privacy Policy/ }).uncheck();
        await register(page);
        expect(await page.getByRole('checkbox', { name: /I agree to the Privacy Policy/ })
            .evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);

        expect(api.callsTo('POST core /signup/:id')).toEqual([]);
    });

    test('core\'s validation errors appear under their fields, with a toast', async ({ page, api }) => {
        api.json('GET core /campaigns/:id', ok(DEFAULT_CAMPAIGN));
        // What core's model sends for these fields (a taken username or email is the database's
        // own message; gender and phone are columns of at most 255 characters).
        const errors = {
            username: ['username must be unique'],
            email: ['email must be unique'],
            password: ['Password should be at least 8 characters long.'],
            first_name: ['First name should only contain letters, spaces and dashes.'],
            last_name: ['Last name should only contain letters, spaces and dashes.'],
            date_of_birth: ['Birthday should be in the past.'],
            gender: ['Gender should be at most 255 characters long.'],
            phone: ['Phone should be at most 255 characters long.']
        };
        api.on('POST core /signup/:id', { status: 422, json: validationError(errors) });
        await page.goto('/signup/default');

        await fillRequired(page);
        await register(page);

        await expect(toast(page, 'Some of the registration data is invalid.')).toBeVisible();
        for (const [message] of Object.values(errors)) {
            await expect(page.getByText(message, { exact: true })).toBeVisible();
        }
        await expect(page).toHaveURL('/signup/default');
    });

    test('a signup that core can\'t mail about gets core\'s message, and nothing is saved', async ({ page, api }) => {
        api.json('GET core /campaigns/:id', ok(DEFAULT_CAMPAIGN));
        api.on('POST core /signup/:id', { status: 503, json: { success: false, message: 'The mail could not be sent, so nothing was saved. Please try again later.' } });
        await page.goto('/signup/default');

        await fillRequired(page);
        await register(page);

        await expect(toast(page, 'Could not register: The mail could not be sent, so nothing was saved. Please try again later.')).toBeVisible();
        await expect(page).toHaveURL('/signup/default');
    });

    test('a campaign removed after the page opened is named on sending', async ({ page, api }) => {
        api.json('GET core /campaigns/:id', ok(DEFAULT_CAMPAIGN));
        api.on('POST core /signup/:id', { status: 404, json: notFound('Campaign is not found.') });
        await page.goto('/signup/default');

        await fillRequired(page);
        await register(page);

        await expect(toast(page, 'The registration campaign is not found.')).toBeVisible();
    });

    test('a campaign that is closed says so and has no form', async ({ page, api }) => {
        api.json('GET core /campaigns/:id', ok({ ...ANTENNA_CAMPAIGN, active: false }));

        await page.goto('/signup/antenna-fair');

        await expect(page.getByText('This registration campaign is closed.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Register', exact: true })).toHaveCount(0);
        await expect(page.getByLabel('Username')).toHaveCount(0);
        // The way to log in stays.
        await expect(page.getByRole('main').getByRole('link', { name: 'Login', exact: true })).toHaveAttribute('href', '/login');
    });

    test('a campaign closed after the page opened gets core\'s answer', async ({ page, api }) => {
        api.json('GET core /campaigns/:id', ok(DEFAULT_CAMPAIGN));
        api.on('POST core /signup/:id', { status: 403, json: forbidden('Campaign is not active.') });
        await page.goto('/signup/default');

        await fillRequired(page);
        await register(page);

        await expect(toast(page, 'Could not register: Campaign is not active.')).toBeVisible();
    });

    test('an unknown campaign sends to the login page', async ({ page, api }) => {
        api.on('GET core /campaigns/:id', { status: 404, json: notFound('Campaign is not found.') });

        await page.goto('/signup/nothing');

        await expect(toast(page, 'Campaign is not found')).toBeVisible();
        await expect(page).toHaveURL('/login');
    });

    test('a campaign that can\'t be loaded sends to the login page with the reason', async ({ page, api }) => {
        api.on('GET core /campaigns/:id', { status: 500, json: { success: false, message: 'Database is down' } });

        await page.goto('/signup/default');

        await expect(toast(page, 'Some error happened: Database is down')).toBeVisible();
        await expect(page).toHaveURL('/login');
    });
});
