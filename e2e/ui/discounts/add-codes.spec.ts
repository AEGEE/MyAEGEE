// Adding codes to a discount integration (/discounts/integrations/:id/add-codes): one code per
// line. The discounts service decides who may add them, and refuses codes the integration has
// already.
import type { Page } from '@playwright/test';

import { notFound, ok, unprocessable } from '../support/factories/base.ts';
import { integration } from '../support/factories/discounts.ts';
import { pageFadedIn } from '../support/discounts-helpers.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const FLIXBUS = integration({ id: 7, name: 'Flixbus' });

const form = (page: Page) => page.getByRole('form', { name: /^Add codes for/ });
const codesField = (page: Page) => page.getByLabel('Please enter each code on a separate line');
const submit = (page: Page) => page.getByRole('button', { name: 'Add codes to integration' });

test.describe('adding codes to a discount integration', () => {
    test('sends one code per line, without the empty lines, and goes back to the list', async ({ page, api }) => {
        api.json('GET discounts /integrations/:id', ok(FLIXBUS));
        api.json('POST discounts /integrations/:id/codes', { success: true, message: 'Codes are populated.' });

        await page.goto('/discounts/integrations/7/add-codes');

        await expect(page.getByRole('heading', { name: 'Add codes for Flixbus' })).toBeVisible();
        await codesField(page).fill('FLIX-1\nFLIX-2\n\n\nFLIX-3\n');
        api.fallback(mockEverything);
        await submit(page).click();

        await expect(toast(page, 'Codes are added.')).toBeVisible();
        await expect(page).toHaveURL(/\/discounts\/integrations$/);
        expect(api.callsTo('GET discounts /integrations/:id').map((call) => call.params)).toEqual([{ id: '7' }]);
        expect(api.callsTo('POST discounts /integrations/:id/codes').map((call) => [call.params, call.body])).toEqual([[{ id: '7' }, ['FLIX-1', 'FLIX-2', 'FLIX-3']]]);
    });

    test('Windows line endings and spaces around a code are not part of it', async ({ page, api }) => {
        api.json('GET discounts /integrations/:id', ok(FLIXBUS));
        api.json('POST discounts /integrations/:id/codes', { success: true, message: 'Codes are populated.' });

        await page.goto('/discounts/integrations/7/add-codes');
        await expect(page.getByRole('heading', { name: 'Add codes for Flixbus' })).toBeVisible();
        await codesField(page).fill('  FLIX-1\r\nFLIX-2\t\r\n \r\nFLIX-3 ');
        api.fallback(mockEverything);
        await submit(page).click();

        await expect(toast(page, 'Codes are added.')).toBeVisible();
        expect(api.callsTo('POST discounts /integrations/:id/codes').map((call) => call.body)).toEqual([['FLIX-1', 'FLIX-2', 'FLIX-3']]);
    });

    test('only empty lines are not sent', async ({ page, api }) => {
        api.json('GET discounts /integrations/:id', ok(FLIXBUS));

        await page.goto('/discounts/integrations/7/add-codes');
        await expect(page.getByRole('heading', { name: 'Add codes for Flixbus' })).toBeVisible();
        await codesField(page).fill('\n   \n\t\n');
        await submit(page).click();

        await expect(toast(page, 'Please add at least 1 not empty code.')).toBeVisible();
        await expect(page).toHaveURL(/\/add-codes$/);
    });

    test('an empty field is not sent: the browser asks for the codes', async ({ page, api }) => {
        api.json('GET discounts /integrations/:id', ok(FLIXBUS));

        await page.goto('/discounts/integrations/7/add-codes');
        await expect(page.getByRole('heading', { name: 'Add codes for Flixbus' })).toBeVisible();
        await submit(page).click();

        await expect(codesField(page)).toBeFocused();
        expect(await codesField(page).evaluate((field: HTMLTextAreaElement) => field.validity.valueMissing)).toBe(true);
        await expect(page).toHaveURL(/\/add-codes$/);
    });

    test('codes the service refuses are named in a toast, and the page stays', async ({ page, api }) => {
        api.json('GET discounts /integrations/:id', ok(FLIXBUS));
        api.on('POST discounts /integrations/:id/codes', { status: 422, json: unprocessable('These codes are stored for this integration already: FLIX-1, FLIX-2.') });

        await page.goto('/discounts/integrations/7/add-codes');
        await expect(page.getByRole('heading', { name: 'Add codes for Flixbus' })).toBeVisible();
        await codesField(page).fill('FLIX-1\nFLIX-2\nFLIX-3');
        await submit(page).click();

        await expect(toast(page, 'Could not add codes: These codes are stored for this integration already: FLIX-1, FLIX-2.')).toBeVisible();
        await expect(page).toHaveURL(/\/add-codes$/);
        await expect(codesField(page)).toHaveValue('FLIX-1\nFLIX-2\nFLIX-3');
        await expect(submit(page)).toBeEnabled();
        expect(api.callsTo('POST discounts /integrations/:id/codes').map((call) => call.body)).toEqual([['FLIX-1', 'FLIX-2', 'FLIX-3']]);
    });

    test('the button is off while the codes are being added', async ({ page, api }) => {
        let release = (): void => {};
        const held = new Promise<void>((resolve) => { release = resolve; });
        api.json('GET discounts /integrations/:id', ok(FLIXBUS));
        api.on('POST discounts /integrations/:id/codes', async () => { await held; return { status: 422, json: unprocessable('These codes are stored for this integration already: FLIX-1.') }; });

        await page.goto('/discounts/integrations/7/add-codes');
        await expect(page.getByRole('heading', { name: 'Add codes for Flixbus' })).toBeVisible();
        await codesField(page).fill('FLIX-1');
        await submit(page).click();

        await expect(submit(page)).toBeDisabled();
        release();
        await expect(toast(page, 'Could not add codes: These codes are stored for this integration already: FLIX-1.')).toBeVisible();
        await expect(submit(page)).toBeEnabled();
    });

    test('while the integration loads, the page says so, and only the form is busy', async ({ page, api }) => {
        let release = (): void => {};
        const held = new Promise<void>((resolve) => { release = resolve; });
        api.on('GET discounts /integrations/:id', async () => { await held; return { json: ok(FLIXBUS) }; });

        await page.goto('/discounts/integrations/7/add-codes');

        await expect(page.getByRole('heading', { name: 'Add codes for integration that is loading' })).toBeVisible();
        await expect(form(page)).toHaveAttribute('aria-busy', 'true');
        await pageFadedIn(page);
        // Nothing covers the rest of the page, such as the bar above the form with the page's name.
        await page.getByRole('heading', { name: 'Add codes to integration' }).click({ trial: true, timeout: 5000 });
        release();
        await expect(page.getByRole('heading', { name: 'Add codes for Flixbus' })).toBeVisible();
        await expect(form(page)).not.toHaveAttribute('aria-busy');
    });

    test('an integration that doesn\'t exist goes back to the list with a toast', async ({ page, api }) => {
        api.on('GET discounts /integrations/:id', { status: 404, json: notFound('The integration is not found.') });
        api.fallback(mockEverything);

        await page.goto('/discounts/integrations/404/add-codes');

        await expect(toast(page, 'Integration is not found')).toBeVisible();
        await expect(page).toHaveURL(/\/discounts\/integrations$/);
    });

    test('an integration that can\'t be loaded goes back to the list with the reason', async ({ page, api }) => {
        api.on('GET discounts /integrations/:id', { status: 500, json: { success: false, message: 'Database is down' } });
        api.fallback(mockEverything);

        await page.goto('/discounts/integrations/7/add-codes');

        await expect(toast(page, 'Some error happened: Database is down')).toBeVisible();
        await expect(page).toHaveURL(/\/discounts\/integrations$/);
    });
});
