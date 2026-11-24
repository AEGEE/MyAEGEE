// The login page (/login): the form, core's answers to it, and where the member goes after
// logging in.
import { answerLogin, storedTokens } from '../support/auth-helpers.ts';
import { forbidden } from '../support/factories/base.ts';
import { member } from '../support/factories/core.ts';
import { openAccountMenu } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { test, expect } from '../support/test.ts';

// What core answers to a name it doesn't know and to a wrong password alike.
const INVALID_CREDENTIALS = 'Username or password is not valid.';

test.describe('login page', () => {
    test.use({ session: 'anonymous' });

    test('logs in, keeps both tokens and lands on the dashboard', async ({ page, api, layout }) => {
        const { tokens } = answerLogin(api);
        // The dashboard is a page of another area.
        api.fallback(mockEverything);
        await page.goto('/login');

        let account = await openAccountMenu(page, layout);
        await expect(account.getByRole('link', { name: 'Login', exact: true })).toBeVisible();

        await page.getByLabel('Email / Username').fill('member');
        await page.getByLabel('Password', { exact: true }).fill('5ecr3t5ecr3t');
        await page.getByRole('button', { name: 'Login', exact: true }).click();

        await expect(page).toHaveURL('/dashboard');
        await expect(page).toHaveTitle('MyAEGEE | Dashboard');
        expect(api.callsTo('POST core /login').map((call) => call.body)).toEqual([{ username: 'member', password: '5ecr3t5ecr3t' }]);
        expect(await page.evaluate(storedTokens)).toEqual([tokens.access_token, tokens.refresh_token]);
        // Who is logged in is asked for with the new token (the dashboard asks once more itself).
        expect([...new Set(api.callsTo('GET core /members/me').map((call) => call.headers['x-auth-token']))]).toEqual([tokens.access_token]);
        expect(api.callsTo('GET core /my_permissions').map((call) => call.headers['x-auth-token'])).toEqual([tokens.access_token]);

        account = await openAccountMenu(page, layout);
        await expect(account.getByRole('button', { name: 'Alex Member' })).toBeVisible();
        await expect(account.getByRole('link', { name: 'Login', exact: true })).toHaveCount(0);
    });

    test('goes on to the page it was sent from', async ({ page, api }) => {
        answerLogin(api);
        api.fallback(mockEverything);
        await page.goto('/login?to=/events/participating');

        await page.getByLabel('Email / Username').fill('member@example.com');
        await page.getByLabel('Password', { exact: true }).fill('5ecr3t5ecr3t');
        await page.getByRole('button', { name: 'Login', exact: true }).click();

        await expect(page).toHaveURL('/events/participating');
        await expect(page).toHaveTitle("MyAEGEE | List events I'm participating at");
        expect(api.callsTo('POST core /login').map((call) => call.body)).toEqual([{ username: 'member@example.com', password: '5ecr3t5ecr3t' }]);
    });

    test('a member whose profile is incomplete goes on to complete it', async ({ page, api }) => {
        answerLogin(api, { member: member({ id: 2, username: 'member', privacy_consent: null }) });
        api.fallback(mockEverything);
        await page.goto('/login?to=/events/participating');

        await page.getByLabel('Email / Username').fill('member');
        await page.getByLabel('Password', { exact: true }).fill('5ecr3t5ecr3t');
        await page.getByRole('button', { name: 'Login', exact: true }).click();

        await expect(page).toHaveURL('/profile/update');
        await expect(page.getByRole('listitem').filter({ hasText: 'You should agree to the Privacy Policy.' })).toBeVisible();
        await expect(page.getByRole('alert').filter({ hasText: 'An error occured while logging in.' })).toBeHidden();
    });

    test('shows core\'s message for a wrong password or an unknown name, and clears it on the next try', async ({ page, api }) => {
        api.on('POST core /login', { status: 403, json: forbidden(INVALID_CREDENTIALS) });
        await page.goto('/login');

        await page.getByLabel('Email / Username').fill('nobody');
        await page.getByLabel('Password', { exact: true }).fill('not-the-password');
        await page.getByRole('button', { name: 'Login', exact: true }).click();
        await expect(page.getByRole('alert').filter({ hasText: INVALID_CREDENTIALS })).toBeVisible();

        // The next try starts without the old message.
        api.on('POST core /login', { status: 403, json: forbidden(INVALID_CREDENTIALS), delayMs: 1000 });
        await page.getByLabel('Email / Username').fill('member');
        await page.getByRole('button', { name: 'Login', exact: true }).click();
        await expect(page.getByText(INVALID_CREDENTIALS)).toBeHidden();
        await expect(page.getByRole('alert').filter({ hasText: INVALID_CREDENTIALS })).toBeVisible();

        await expect(page).toHaveURL('/login');
        expect(api.callsTo('POST core /login').map((call) => call.body)).toEqual([
            { username: 'nobody', password: 'not-the-password' },
            { username: 'member', password: 'not-the-password' }
        ]);
    });

    test('tells a member whose address is not confirmed yet to confirm it', async ({ page, api }) => {
        api.on('POST core /login', { status: 403, json: forbidden('Please confirm your mail first.') });
        await page.goto('/login');

        await page.getByLabel('Email / Username').fill('new-member');
        await page.getByLabel('Password', { exact: true }).fill('5ecr3t5ecr3t');
        await page.getByRole('button', { name: 'Login', exact: true }).click();

        await expect(page.getByRole('alert').filter({ hasText: 'Please confirm your mail first.' })).toBeVisible();
        expect(await page.evaluate(storedTokens)).toEqual([null, null]);
    });

    test('tells a suspended member that the account is suspended', async ({ page, api }) => {
        api.on('POST core /login', { status: 403, json: forbidden('This account is suspended.') });
        await page.goto('/login');

        await page.getByLabel('Email / Username').fill('suspended');
        await page.getByLabel('Password', { exact: true }).fill('5ecr3t5ecr3t');
        await page.getByRole('button', { name: 'Login', exact: true }).click();

        await expect(page.getByRole('alert').filter({ hasText: 'This account is suspended.' })).toBeVisible();
    });

    test('shows a general message when core can\'t be reached or doesn\'t say why', async ({ page, api }) => {
        api.on('POST core /login', { abort: 'failed' });
        await page.goto('/login');

        await page.getByLabel('Email / Username').fill('member');
        await page.getByLabel('Password', { exact: true }).fill('5ecr3t5ecr3t');
        await page.getByRole('button', { name: 'Login', exact: true }).click();
        await expect(page.getByRole('alert').filter({ hasText: 'An error occured while logging in.' })).toBeVisible();

        // An answer without success and without a message.
        api.json('POST core /login', { success: false });
        await page.getByRole('button', { name: 'Login', exact: true }).click();
        await expect.poll(() => api.callsTo('POST core /login')).toHaveLength(2);
        await expect(page.getByRole('alert').filter({ hasText: 'An error occured while logging in.' })).toBeVisible();

        // A server error without a body.
        api.on('POST core /login', { status: 500, body: '' });
        await page.getByRole('button', { name: 'Login', exact: true }).click();
        await expect.poll(() => api.callsTo('POST core /login')).toHaveLength(3);
        await expect(page.getByRole('alert').filter({ hasText: 'An error occured while logging in.' })).toBeVisible();

        await expect(page).toHaveURL('/login');
        expect(await page.evaluate(storedTokens)).toEqual([null, null]);
    });

    test('sends nothing while a field is empty', async ({ page, api }) => {
        await page.goto('/login');
        const username = page.getByLabel('Email / Username');
        const password = page.getByLabel('Password', { exact: true });

        await page.getByRole('button', { name: 'Login', exact: true }).click();
        expect(await username.evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);

        await username.fill('member');
        await page.getByRole('button', { name: 'Login', exact: true }).click();
        expect(await password.evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);

        await expect(page).toHaveURL('/login');
        expect(api.callsTo('POST core /login')).toEqual([]);
    });

    test('the eye button shows the password and hides it again', async ({ page }) => {
        await page.goto('/login');
        const password = page.getByLabel('Password', { exact: true });
        await password.fill('5ecr3t5ecr3t');
        await expect(password).toHaveAttribute('type', 'password');

        await page.getByRole('button', { name: 'Show password' }).click();
        await expect(password).toHaveAttribute('type', 'text');
        await expect(password).toHaveValue('5ecr3t5ecr3t');

        await page.getByRole('button', { name: 'Hide password' }).click();
        await expect(password).toHaveAttribute('type', 'password');
    });

    test('links to signing up and to resetting the password', async ({ page }) => {
        await page.goto('/login');

        await expect(page.getByRole('main').getByRole('link', { name: 'Register' })).toHaveAttribute('href', '/signup/default');
        await expect(page.getByRole('link', { name: 'Forgot your password?' })).toHaveAttribute('href', '/password_reset');
        await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
    });
});
