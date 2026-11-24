// Helpers for the real-stack flows of the area `auth` (tests/auth-*.spec.ts): signing up,
// logging in through the login page, and the accounts those flows leave behind.
import { expect, type Page } from '@playwright/test';

import type { Api, Envelope } from './api.ts';
import { asAdmin, type Cleanup } from './core-data.ts';
import { PASSWORD } from './constants.ts';

export interface NewAccount {
    username: string;
    email: string;
    password: string;
}

// A username and an address that no other test uses.
export const newAccount = (prefix: string): NewAccount => {
    const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    return { username: `e2e-${prefix}-${suffix}`, email: `e2e-${prefix}-${suffix}@example.com`, password: PASSWORD };
};

// Deletes the account with this username, if there is one: for an account a test made through
// the signup page, whose id the test never saw.
export const removeAccount = (api: Api, username: string): Cleanup => async () => {
    const found = await asAdmin<{ id: number; username: string }[]>(api, 'GET', `/members?query=${encodeURIComponent(username)}`);
    for (const account of found.filter((item) => item.username === username)) {
        await asAdmin(api, 'DELETE', `/members/${account.id}`);
    }
};

// Signs up through the API, without confirming the address.
export const signUpThroughApi = async (api: Api, campaignUrl: string, account: NewAccount): Promise<void> => {
    const answer = await api.call<Envelope<{ id: number }>>(null, 'POST', `/api/core/signup/${campaignUrl}`, {
        username: account.username,
        email: account.email,
        password: account.password,
        first_name: 'Nora',
        last_name: 'Newcomer',
        privacy_consent: new Date()
    });
    expect(answer.status, `signup ${account.username}: ${JSON.stringify(answer.body)}`).toBe(200);
};

// Fills in and sends the signup form of the page that is open.
export const signUpThroughPage = async (page: Page, account: NewAccount): Promise<void> => {
    await page.getByLabel('Username').fill(account.username);
    await page.getByLabel('Email').fill(account.email);
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill(account.password);
    await page.getByLabel('Password confirmation').fill(account.password);
    await page.getByLabel('First name').fill('Nora');
    await page.getByLabel('Last name').fill('Newcomer');
    await page.getByRole('checkbox', { name: /I agree to the Privacy Policy/ }).check();
    await page.getByRole('button', { name: 'Register', exact: true }).click();
};

// Logs in through the login page that is open.
export const logInThroughPage = async (page: Page, username: string, password: string = PASSWORD): Promise<void> => {
    await page.getByLabel('Email / Username').fill(username);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Login', exact: true }).click();
};

// A fresh pair of tokens for `username`, made by a login of its own, so that renewing or
// revoking them leaves the tokens the other helpers keep alone.
export const freshTokens = async (api: Api, username: string, password: string = PASSWORD): Promise<{ access_token: string; refresh_token: string }> => {
    const answer = await api.call<{ access_token: string; refresh_token: string }>(null, 'POST', '/api/core/login', { username, password });
    expect(answer.status, `login ${username}: ${JSON.stringify(answer.body)}`).toBe(200);
    return answer.body;
};

// The tokens the frontend keeps in localStorage.
export const storedTokens = (page: Page): Promise<[string | null, string | null]> => page.evaluate(() => [localStorage.getItem('access-token'), localStorage.getItem('refresh-token')]);
