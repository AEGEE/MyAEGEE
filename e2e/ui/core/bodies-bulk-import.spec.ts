// Importing members into a body from a CSV file (/bodies/:id/bulk_import).
import path from 'node:path';

import type { Page } from '@playwright/test';

import { ok, validationError } from '../support/factories/base.ts';
import { cellOf, expectEmptyTable, tableRows, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const fixture = (name: string): string => path.join(import.meta.dirname, '../fixtures/core', name);
const membersTable = (page: Page) => page.getByRole('table');
const rowOf = (page: Page, name: string) => tableRows(membersTable(page)).filter({ hasText: name });
const createMembers = (page: Page) => page.getByRole('button', { name: 'Create members' });

test.describe('bulk import of members', () => {
    test('explains the file format and starts empty', async ({ page }) => {
        await page.goto('/bodies/1/bulk_import');

        await expect(page.getByRole('heading', { name: 'Bulk import members' })).toBeVisible();
        await expect(page).toHaveTitle('MyAEGEE | Bulk importing members for body');
        await expect(page.getByText('Select the CSV file for users to import with the following format: first_name,last_name,email. The username is generated automatically based on first and last name.')).toBeVisible();
        await expectEmptyTable(membersTable(page));
        await expect(createMembers(page)).toBeHidden();
    });

    test('lists the people of the file with their usernames', async ({ page }) => {
        await page.goto('/bodies/1/bulk_import');
        await page.getByLabel('CSV file').setInputFiles(fixture('members.csv'));

        const table = membersTable(page);
        await expect(tableRows(table)).toHaveCount(3);
        await expect(await cellOf(table, rowOf(page, 'jane@example.com'), 'Username')).toHaveText('jane.doe');
        await expect(await cellOf(table, rowOf(page, 'john@example.com'), 'First name')).toHaveText('John');
        await expect(await cellOf(table, rowOf(page, 'john@example.com'), 'Last name')).toHaveText('Smith');
        await expect(await cellOf(table, rowOf(page, 'john@example.com'), 'Username')).toHaveText('john.smith');
        await expect(await cellOf(table, rowOf(page, 'anna@example.com'), 'Username')).toHaveText('anna.vandijk');
        await expect(createMembers(page)).toBeVisible();
    });

    test('skips the header line and blank lines of a Windows file', async ({ page }) => {
        await page.goto('/bodies/1/bulk_import');
        await page.getByLabel('CSV file').setInputFiles(fixture('members-crlf.csv'));

        const table = membersTable(page);
        await expect(tableRows(table)).toHaveCount(2);
        await expect(await cellOf(table, rowOf(page, 'jane@example.com'), 'Username')).toHaveText('jane.doe');
        await expect(await cellOf(table, rowOf(page, 'john@example.com'), 'Username')).toHaveText('john.smith');
        await expect(toast(page, 'CSV is malformed.')).toHaveCount(0);
    });

    test('keeps separators inside quotes and ignores further columns', async ({ page }) => {
        await page.goto('/bodies/1/bulk_import');
        await page.getByLabel('CSV file').setInputFiles(fixture('members-quoted.csv'));

        const table = membersTable(page);
        await expect(tableRows(table)).toHaveCount(2);
        await expect(await cellOf(table, rowOf(page, 'jane@example.com'), 'Last name')).toHaveText('Doe, "Jr."');
        await expect(await cellOf(table, rowOf(page, 'jane@example.com'), 'Email')).toHaveText('jane@example.com');
        await expect(await cellOf(table, rowOf(page, 'john@example.com'), 'Email')).toHaveText('john@example.com');
    });

    test('refuses a file with a line of fewer than three fields', async ({ page }) => {
        await page.goto('/bodies/1/bulk_import');
        await page.getByLabel('CSV file').setInputFiles(fixture('members.csv'));
        await expect(tableRows(membersTable(page))).toHaveCount(3);
        await page.getByLabel('CSV file').setInputFiles(fixture('members-bad.csv'));

        await expect(toast(page, 'CSV is malformed.')).toBeVisible();
        await expect(tableRows(membersTable(page))).toHaveCount(3);
    });

    test('changes nothing when no file is chosen', async ({ page }) => {
        await page.goto('/bodies/1/bulk_import');
        await page.getByLabel('CSV file').setInputFiles(fixture('members.csv'));
        await expect(tableRows(membersTable(page))).toHaveCount(3);
        await page.getByLabel('CSV file').setInputFiles([]);

        await expect(tableRows(membersTable(page))).toHaveCount(3);
    });

    test('a person can be left out before creating', async ({ page }) => {
        await page.goto('/bodies/1/bulk_import');
        await page.getByLabel('CSV file').setInputFiles(fixture('members.csv'));
        await rowOf(page, 'john@example.com').getByRole('button', { name: 'Delete user' }).click();

        await expect(tableRows(membersTable(page))).toHaveCount(2);
        await expect(rowOf(page, 'john@example.com')).toHaveCount(0);
    });

    test('creates the members one after the other', async ({ page, api }) => {
        api.on('POST core /bodies/:id/create-member', ({ body }) => ({
            json: ok({ id: 1 }),
            delayMs: (body as { username: string }).username === 'jane.doe' ? 1000 : 0
        }));

        await page.goto('/bodies/1/bulk_import');
        await page.getByLabel('CSV file').setInputFiles(fixture('members.csv'));
        await createMembers(page).click();

        const table = membersTable(page);
        await expect(await cellOf(table, rowOf(page, 'jane@example.com'), 'Status')).toHaveText('Saving...');
        await expect.poll(() => api.callsTo('POST core /bodies/:id/create-member')).toHaveLength(1);
        await expect(await cellOf(table, rowOf(page, 'anna@example.com'), 'Status')).toHaveText('Successfully saved.');
        await expect(await cellOf(table, rowOf(page, 'jane@example.com'), 'Status')).toHaveText('Successfully saved.');
        await expect(toast(page, 'User is created.').first()).toBeVisible();
        await expect(table.getByRole('button', { name: 'Delete user' })).toHaveCount(0);
        const calls = api.callsTo('POST core /bodies/:id/create-member');
        expect(calls.map((call) => call.params)).toEqual([{ id: '1' }, { id: '1' }, { id: '1' }]);
        expect(calls[0].body).toMatchObject({ first_name: 'Jane', last_name: 'Doe', username: 'jane.doe', email: 'jane@example.com' });
        expect(calls[1].body).toMatchObject({ first_name: 'John', last_name: 'Smith', username: 'john.smith', email: 'john@example.com' });
        expect(calls[2].body).toMatchObject({ first_name: 'Anna', last_name: 'van Dijk', username: 'anna.vandijk', email: 'anna@example.com' });
    });

    test('shows why a person was refused and tries only them again', async ({ page, api }) => {
        api.on('POST core /bodies/:id/create-member', ({ body }) => ((body as { username: string }).username === 'john.smith'
            ? { status: 422, json: validationError({ username: ['username must be unique'] }) }
            : { json: ok({ id: 1 }) }));

        await page.goto('/bodies/1/bulk_import');
        await page.getByLabel('CSV file').setInputFiles(fixture('members.csv'));
        await createMembers(page).click();

        const table = membersTable(page);
        await expect(toast(page, 'Some of the user data is invalid.')).toBeVisible();
        const john = await cellOf(table, rowOf(page, 'john@example.com'), 'Status');
        await expect(john).toContainText('Error while saving:');
        await expect(john).toContainText('username must be unique');
        await expect(await cellOf(table, rowOf(page, 'anna@example.com'), 'Status')).toHaveText('Successfully saved.');
        await expect(rowOf(page, 'john@example.com').getByRole('button', { name: 'Delete user' })).toHaveCount(0);
        await expect.poll(() => api.callsTo('POST core /bodies/:id/create-member').length).toBe(3);

        await createMembers(page).click();
        await expect.poll(() => api.callsTo('POST core /bodies/:id/create-member').length).toBe(4);
        await expect.poll(() => api.callsTo('POST core /bodies/:id/create-member').at(-1)!.body).toMatchObject({ username: 'john.smith' });
    });

    test('says why the service failed', async ({ page, api }) => {
        api.on('POST core /bodies/:id/create-member', { status: 403, json: { success: false, message: 'Permission create_member:body is required, but not present.' } });

        await page.goto('/bodies/1/bulk_import');
        await page.getByLabel('CSV file').setInputFiles(fixture('members-quoted.csv'));
        await createMembers(page).click();

        await expect(toast(page, 'Could not create user: Permission create_member:body is required, but not present.').first()).toBeVisible();
        await expect(await cellOf(membersTable(page), rowOf(page, 'jane@example.com'), 'Status')).toContainText('Error while saving:');
    });
});

test.describe('bulk import for a visitor', () => {
    test.use({ session: 'anonymous' });

    test('sends the visitor to the login page first', async ({ page }) => {
        await page.goto('/bodies/1/bulk_import');

        await expect(page).toHaveURL('/login?to=%2Fbodies%2F1%2Fbulk_import');
    });
});
