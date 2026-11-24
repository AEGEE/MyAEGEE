// The member's codes (/discounts/my): the codes they claimed, and claiming a new one from a
// partner. Members only; the discounts service decides who may claim (members of an antenna,
// contact antenna or contact) and how many codes per period.
import type { Page } from '@playwright/test';

import { forbidden, ok } from '../support/factories/base.ts';
import { discountCode, integration, myDiscountCode } from '../support/factories/discounts.ts';
import { cellOf, expectEmptyTable, tableRows, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const FLIXBUS = integration({ id: 1, name: 'Flixbus', description: 'Use the code on **flixbus.com**.' });
const HOSTELWORLD = integration({ id: 2, name: 'Hostelworld', description: 'No booking fee in *every* hostel.' });

const codesPage = (page: Page) => page.getByRole('article', { name: 'My codes claimed' });
const codesTable = (page: Page) => codesPage(page).getByRole('table');

test.describe('my discount codes', () => {
    test('claiming a code of the chosen partner adds it on top, with a toast', async ({ page, api }) => {
        api.json('GET discounts /codes/mine', ok([myDiscountCode({ value: 'FLIX-OLD', integration: FLIXBUS })]));
        api.json('GET discounts /integrations', ok([FLIXBUS, HOSTELWORLD]));
        api.json('POST discounts /integrations/:id/claim', ok(discountCode({ value: 'HOSTEL-NEW', integration_id: 2, claimed_by: 2 })));

        await page.goto('/discounts/my');

        const partner = page.getByLabel('Partner');
        // The first partner is chosen already.
        await expect(partner).toHaveValue(/./);
        await expect(partner.getByRole('option', { selected: true })).toHaveText('Flixbus');
        await partner.selectOption({ label: 'Hostelworld' });
        await page.getByRole('button', { name: 'Claim code!' }).click();

        await expect(toast(page, 'Code is added.')).toBeVisible();
        const rows = tableRows(codesTable(page));
        await expect(rows).toHaveCount(2);
        await expect(await cellOf(codesTable(page), rows.first(), 'Code')).toHaveText('HOSTEL-NEW');
        await expect(await cellOf(codesTable(page), rows.first(), 'Partner name')).toHaveText('Hostelworld');
        await expect(await cellOf(codesTable(page), rows.first(), 'Description')).toContainText('No booking fee in every hostel.');
        await expect(await cellOf(codesTable(page), rows.nth(1), 'Code')).toHaveText('FLIX-OLD');
        expect(api.callsTo('POST discounts /integrations/:id/claim').map((call) => [call.params, call.body])).toEqual([[{ id: '2' }, undefined]]);
        expect(api.callsTo('GET discounts /codes/mine')).toHaveLength(1);
        expect(api.callsTo('GET discounts /integrations')).toHaveLength(1);
    });

    test('shows the codes claimed before, with when, the partner and its description', async ({ page, api }) => {
        api.json('GET discounts /codes/mine', ok([
            myDiscountCode({ value: 'HOSTEL-123', updated_at: '2027-07-03T12:00:05.000Z', integration: HOSTELWORLD }),
            myDiscountCode({ value: 'FLIX-456', updated_at: '2027-02-14T09:30:15.000Z', integration: FLIXBUS })
        ]));
        api.json('GET discounts /integrations', ok([FLIXBUS, HOSTELWORLD]));

        await page.goto('/discounts/my');

        const table = codesTable(page);
        const rows = tableRows(table);
        await expect(rows).toHaveCount(2);
        // In the time of Brussels: summer time, then winter time.
        await expect(await cellOf(table, rows.first(), 'Claimed on')).toHaveText('2027-07-03 14:00:05');
        await expect(await cellOf(table, rows.nth(1), 'Claimed on')).toHaveText('2027-02-14 10:30:15');
        await expect(await cellOf(table, rows.nth(1), 'Partner name')).toHaveText('Flixbus');
        const description = await cellOf(table, rows.nth(1), 'Description');
        await expect(description.getByRole('strong')).toHaveText('flixbus.com');
        await expect(await cellOf(table, rows.first(), 'Description')).toContainText('No booking fee in every hostel.');
        await expect((await cellOf(table, rows.first(), 'Description')).getByRole('emphasis')).toHaveText('every');
    });

    test('without codes the table says so; without partners claiming asks for one and sends nothing', async ({ page, api }) => {
        api.json('GET discounts /codes/mine', ok([]));
        api.json('GET discounts /integrations', ok([]));

        await page.goto('/discounts/my');

        await expect(codesPage(page)).not.toHaveAttribute('aria-busy');
        await expectEmptyTable(codesTable(page));
        await expect(page.getByLabel('Partner').getByRole('option')).toHaveCount(0);
        await page.getByRole('button', { name: 'Claim code!' }).click();
        await expect(toast(page, 'Please select a partner first.')).toBeVisible();
        expect(api.callsTo('POST discounts /integrations/:id/claim')).toEqual([]);
    });

    test('a refused claim shows the service\'s reason and adds nothing', async ({ page, api }) => {
        api.json('GET discounts /codes/mine', ok([]));
        api.json('GET discounts /integrations', ok([FLIXBUS]));
        api.on('POST discounts /integrations/:id/claim', { status: 403, json: forbidden('Your quota is exceeded for this integration.') });

        await page.goto('/discounts/my');
        await expect(page.getByLabel('Partner').getByRole('option', { selected: true })).toHaveText('Flixbus');
        await page.getByRole('button', { name: 'Claim code!' }).click();

        await expect(toast(page, 'Could not claim code: Your quota is exceeded for this integration.')).toBeVisible();
        await expectEmptyTable(codesTable(page));
        expect(api.callsTo('POST discounts /integrations/:id/claim').map((call) => call.params)).toEqual([{ id: '1' }]);
    });

    test('a member who is in no antenna, contact antenna or contact is told that they may not claim', async ({ page, api }) => {
        api.json('GET discounts /codes/mine', ok([]));
        api.json('GET discounts /integrations', ok([FLIXBUS]));
        api.on('POST discounts /integrations/:id/claim', { status: 403, json: forbidden('Only members of an antenna, contact antenna or contact can claim codes.') });

        await page.goto('/discounts/my');
        await expect(page.getByLabel('Partner').getByRole('option', { selected: true })).toHaveText('Flixbus');
        await page.getByRole('button', { name: 'Claim code!' }).click();

        await expect(toast(page, 'Could not claim code: Only members of an antenna, contact antenna or contact can claim codes.')).toBeVisible();
        await expectEmptyTable(codesTable(page));
    });

    test('a claim whose mail could not be sent still shows the code', async ({ page, api }) => {
        api.json('GET discounts /codes/mine', ok([]));
        api.json('GET discounts /integrations', ok([FLIXBUS]));
        // The service keeps the claim when its mail fails, and answers as usual: the code is
        // shown here either way.
        api.json('POST discounts /integrations/:id/claim', ok(discountCode({ value: 'FLIX-NOMAIL', integration_id: 1 })));

        await page.goto('/discounts/my');
        await expect(page.getByLabel('Partner').getByRole('option', { selected: true })).toHaveText('Flixbus');
        await page.getByRole('button', { name: 'Claim code!' }).click();

        await expect(toast(page, 'Code is added.')).toBeVisible();
        const rows = tableRows(codesTable(page));
        await expect(rows).toHaveCount(1);
        await expect(await cellOf(codesTable(page), rows.first(), 'Code')).toHaveText('FLIX-NOMAIL');
        await expect(await cellOf(codesTable(page), rows.first(), 'Partner name')).toHaveText('Flixbus');
    });

    test('says so when the codes cannot be loaded', async ({ page, api }) => {
        api.on('GET discounts /codes/mine', { status: 500, json: { success: false, message: 'Database is down' } });

        await page.goto('/discounts/my');

        await expect(toast(page, 'Could not fetch discounts: Database is down')).toBeVisible();
        await expect(codesPage(page)).not.toHaveAttribute('aria-busy');
    });

    test('says so when the partners cannot be loaded', async ({ page, api }) => {
        api.json('GET discounts /codes/mine', ok([myDiscountCode({ value: 'FLIX-OLD', integration: FLIXBUS })]));
        api.on('GET discounts /integrations', { status: 500, json: { success: false, message: 'Database is down' } });

        await page.goto('/discounts/my');

        await expect(toast(page, 'Could not fetch discounts: Database is down')).toBeVisible();
        await expect(codesPage(page)).not.toHaveAttribute('aria-busy');
        await expect(page.getByLabel('Partner').getByRole('option')).toHaveCount(0);
    });

    test('is busy until the codes and partners are in', async ({ page, api }) => {
        let release = (): void => {};
        const held = new Promise<void>((resolve) => { release = resolve; });
        api.json('GET discounts /codes/mine', ok([myDiscountCode({ value: 'FLIX-OLD', integration: FLIXBUS })]));
        api.on('GET discounts /integrations', async () => { await held; return { json: ok([FLIXBUS]) }; });

        await page.goto('/discounts/my');

        await expect(codesPage(page)).toHaveAttribute('aria-busy', 'true');
        release();
        await expect(codesPage(page)).not.toHaveAttribute('aria-busy');
        await expect(tableRows(codesTable(page))).toHaveCount(1);
    });
});
