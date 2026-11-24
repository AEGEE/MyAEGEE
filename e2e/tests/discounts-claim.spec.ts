// Claiming discount codes across core and discounts: the discounts service asks core who the
// member is and which bodies they belong to, and only lets members of an antenna, contact
// antenna or contact claim. The rules themselves are covered by the discounts service's tests.
import type { Page } from '@playwright/test';

import { test, expect, expectStatus, loginInBrowser, type Envelope } from '../support/api.ts';
import { asAdmin } from '../support/core-data.ts';
import { addCodes, createIntegration, type RealIntegration } from '../support/discounts-data.ts';

const toast = (page: Page, text: string) => page.getByRole('alert').or(page.getByRole('status')).filter({ hasText: text });

const claimFrom = async (page: Page, partner: RealIntegration): Promise<void> => {
    await page.goto('/discounts/my');
    await expect(page.getByRole('heading', { name: 'My codes claimed' })).toBeVisible();
    await page.getByLabel('Partner').selectOption({ label: partner.name });
    await page.getByRole('button', { name: 'Claim code!' }).click();
};

test.describe('claiming discount codes', () => {
    test('a member of an antenna claims a code a discounts manager added, and gets it by mail', async ({ api, page, otherAntenna }) => {
        const partner = await createIntegration(api);
        const [code] = await addCodes(api, partner, 1);
        const { member } = otherAntenna;

        await loginInBrowser(page, api, member.username);
        await claimFrom(page, partner);

        await expect(toast(page, 'Code is added.')).toBeVisible();
        const table = page.getByRole('table');
        const row = table.getByRole('row').filter({ hasText: code });
        await expect(row).toContainText(partner.name);

        const mail = await api.waitForMail({ to: member.email, template: 'custom.html' });
        expect(mail.subject).toBe(`Your ${partner.name} discount code`);
        expect(String(mail.parameters.email_body)).toContain(`Code: ${code}`);

        // The claim is kept: the page shows it again when it loads.
        await page.reload();
        await expect(table.getByRole('row').filter({ hasText: code })).toContainText(partner.name);
    });

    test('a member of no antenna, contact antenna or contact is told that they may not claim', async ({ api, page, otherAntenna }) => {
        const partner = await createIntegration(api);
        await addCodes(api, partner, 1);
        // The member's only body becomes one of the kind "other": MyAEGEE lets its members in, but
        // they may not claim codes.
        const { body, member } = otherAntenna;
        await asAdmin(api, 'PUT', `/bodies/${body.id}`, { type: 'other' });

        await loginInBrowser(page, api, member.username);
        await claimFrom(page, partner);

        await expect(toast(page, 'Could not claim code: Only members of an antenna, contact antenna or contact can claim codes.')).toBeVisible();
        const mine = await api.call<Envelope<unknown[]>>(member.username, 'GET', '/api/discounts/codes/mine');
        expectStatus(mine, 200);
        expect(mine.body.data).toEqual([]);
    });

    test('a discounts manager creates an integration and adds codes to it', async ({ api, page }) => {
        const name = `E2E partner ${Date.now()}`;

        await loginInBrowser(page, api, 'admin');
        await page.goto('/discounts/integrations');
        await page.getByRole('link', { name: 'Create integration' }).click();
        const form = page.getByRole('form', { name: 'Create integration' });
        await form.getByLabel('Name', { exact: true }).fill(name);
        await form.getByLabel('Description', { exact: true }).fill('Use the code on **example.org**.');
        await form.getByLabel('Code', { exact: true }).fill(`e2e-${Date.now()}`);
        await form.getByLabel('Codes per period').fill('2');
        await form.getByLabel('Period', { exact: true }).selectOption({ label: 'Year' });
        await form.getByRole('button', { name: 'Save integration' }).click();

        await expect(page).toHaveURL(/\/discounts\/integrations$/);
        const row = page.getByRole('row').filter({ hasText: name });
        await expect(row).toContainText('2/year');

        await page.getByRole('link', { name: `Add codes to ${name}` }).click();
        await expect(page.getByRole('heading', { name: `Add codes for ${name}` })).toBeVisible();
        await page.getByLabel('Please enter each code on a separate line').fill(' E2E-A \r\nE2E-B\n\nE2E-A');
        await page.getByRole('button', { name: 'Add codes to integration' }).click();
        await expect(toast(page, 'Codes are added.')).toBeVisible();
        await expect(page).toHaveURL(/\/discounts\/integrations$/);

        // The same codes again: the service refuses them, and the page says which.
        await page.getByRole('link', { name: `Add codes to ${name}` }).click();
        await expect(page.getByRole('heading', { name: `Add codes for ${name}` })).toBeVisible();
        await page.getByLabel('Please enter each code on a separate line').fill('E2E-B\nE2E-C');
        await page.getByRole('button', { name: 'Add codes to integration' }).click();
        await expect(toast(page, 'Could not add codes: These codes are stored for this integration already: E2E-B.')).toBeVisible();
    });
});
