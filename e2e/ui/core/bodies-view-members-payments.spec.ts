// Membership fees on the members page of a body (/bodies/:id/members): the expiry column, the
// dialogs to add a payment and to list and delete a member's payments.
import type { Page } from '@playwright/test';

import { FIXED_NOW, iso, ok, validationError } from '../support/factories/base.ts';
import { bodyMembership, payment, type BodyMembership, type Payment } from '../support/factories/core.ts';
import { bodyDetail } from '../support/factories/core-bodies.ts';
import type { ApiMock } from '../support/api-mock.ts';
import { cellOf, dialog, fillDate, freezeTime, permissionsFor, sortBy, tableRows, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const membership = (first: string, last: string, overrides: Partial<BodyMembership> = {}): BodyMembership => {
    const made = bodyMembership({ body_id: 1, ...overrides });
    return { ...made, user: { ...made.user, first_name: first, last_name: last } };
};

const membersTable = (page: Page) => page.getByRole('region', { name: 'Members of the body' }).getByRole('table');
const rowOf = (page: Page, name: string) => tableRows(membersTable(page)).filter({ hasText: name });

const ann = () => membership('Ann', 'Able', { id: 71, user_id: 31 });
const bob = () => membership('Bob', 'Bee', { id: 72, user_id: 32 });

const ALL = ['local:view:payment', 'local:create:payment', 'global:delete:payment'];

const answer = (api: ApiMock, { members = [ann(), bob()], permissions = ALL, payments = [] as Payment[], paysFees = true } = {}): void => {
    api.json('GET core /bodies/:id', ok(bodyDetail({ id: 1, pays_fees: paysFees })));
    api.json('GET core /bodies/:id/members', ok(members));
    permissionsFor(api, 'bodies', 1, permissions);
    if (permissions.includes('local:view:payment') && paysFees) api.json('GET core /bodies/:id/payments', ok(payments));
};

test.describe('membership fees of a body', () => {
    test('shows when the last payment of each member expires', async ({ page, api }) => {
        answer(api, {
            payments: [
                payment({ user_id: 31, body_id: 1, starts: '2026-01-01', expires: '2027-01-01' }),
                payment({ user_id: 31, body_id: 1, starts: '2025-01-01', expires: '2026-01-01' }),
                payment({ user_id: 99, body_id: 1, starts: '2026-06-01', expires: '2027-06-01' })
            ]
        });

        await page.goto('/bodies/1/members');

        const table = membersTable(page);
        await expect(await cellOf(table, rowOf(page, 'Ann Able'), 'Last payment exp. date')).toHaveText('2027-01-01');
        await expect(await cellOf(table, rowOf(page, 'Bob Bee'), 'Last payment exp. date')).toHaveText('');
        await expect(rowOf(page, 'Ann Able').getByRole('button', { name: 'View or manage payments' })).toBeVisible();
        await expect(rowOf(page, 'Ann Able').getByRole('button', { name: 'Add fee payment' })).toBeVisible();
        await expect.poll(() => api.callsTo('GET core /bodies/:id/payments')[0].params).toEqual({ id: '1' });
    });

    test('sorts the members by when their last payment expires', async ({ page, api, layout }) => {
        answer(api, {
            members: [ann(), bob(), membership('Cid', 'Cole', { user_id: 33 })],
            payments: [
                payment({ user_id: 31, body_id: 1, expires: '2027-05-01' }),
                payment({ user_id: 32, body_id: 1, expires: '2026-05-01' }),
                payment({ user_id: 33, body_id: 1, expires: '2028-05-01' })
            ]
        });

        await page.goto('/bodies/1/members');
        const table = membersTable(page);
        await expect(tableRows(table).first()).toContainText('Ann Able');
        await sortBy(table, 'Last payment exp. date', layout);

        await expect(tableRows(table).nth(0)).toContainText('Bob Bee');
        await expect(tableRows(table).nth(1)).toContainText('Ann Able');
        await expect(tableRows(table).nth(2)).toContainText('Cid Cole');
    });

    test('a body without fees has no payment columns and asks for no payments', async ({ page, api }) => {
        answer(api, { paysFees: false });

        await page.goto('/bodies/1/members');

        await expect(tableRows(membersTable(page))).toHaveCount(2);
        await expect(membersTable(page).getByRole('button', { name: 'View or manage payments' })).toHaveCount(0);
        await expect(membersTable(page).getByRole('button', { name: 'Add fee payment' })).toHaveCount(0);
        await expect(membersTable(page).getByText('Last payment exp. date')).toHaveCount(0);
        expect(api.callsTo('GET core /bodies/:id/payments')).toHaveLength(0);
    });

    test('lists the payments of a member, without deleting for those who may not', async ({ page, api }) => {
        answer(api, {
            permissions: ['local:view:payment'],
            payments: [payment({ id: 501, user_id: 31, body_id: 1, starts: '2026-01-01', expires: '2027-01-01', amount: 12.5, currency: 'EUR', invoice_name: 'A. Able', invoice_address: 'Main street 1' })]
        });

        await page.goto('/bodies/1/members');
        await rowOf(page, 'Ann Able').getByRole('button', { name: 'View or manage payments' }).click();

        const modal = dialog(page, 'Fee payments for Ann Able');
        await expect(modal.getByText('Fee payments for Ann Able')).toBeVisible();
        const table = modal.getByRole('table');
        const row = tableRows(table).first();
        await expect(tableRows(table)).toHaveCount(1);
        await expect(await cellOf(table, row, '#')).toHaveText('501');
        await expect(await cellOf(table, row, 'Starts at')).toHaveText('2026-01-01');
        await expect(await cellOf(table, row, 'Expires on')).toHaveText('2027-01-01');
        await expect(await cellOf(table, row, 'Amount')).toHaveText('12.5');
        await expect(await cellOf(table, row, 'Currency')).toHaveText('EUR');
        await expect(await cellOf(table, row, 'Invoice address')).toHaveText('Main street 1');
        await expect(await cellOf(table, row, 'Invoice name')).toHaveText('A. Able');
        await expect(modal.getByRole('button', { name: 'Delete' })).toHaveCount(0);
        await expect(rowOf(page, 'Ann Able').getByRole('button', { name: 'Add fee payment' })).toHaveCount(0);

        await modal.getByRole('button', { name: 'close' }).click();
        await expect(modal).toBeHidden();
    });

    test('a member without payments has an empty list', async ({ page, api }) => {
        answer(api);

        await page.goto('/bodies/1/members');
        await rowOf(page, 'Bob Bee').getByRole('button', { name: 'View or manage payments' }).click();

        const modal = dialog(page, 'Fee payments for Bob Bee');
        await expect(modal.getByText('Nothing here.')).toBeVisible();
        await expect(modal.getByRole('table')).toHaveCount(0);
    });

    test('deletes a payment after asking which one', async ({ page, api }) => {
        answer(api, {
            members: [membership('Ann', '<b>Able</b>', { id: 71, user_id: 31 })],
            payments: [
                payment({ id: 501, user_id: 31, body_id: 1, starts: '2025-01-01', expires: '2026-01-01', amount: 10, currency: 'EUR' }),
                payment({ id: 502, user_id: 31, body_id: 1, starts: '2026-01-01', expires: '2027-01-01', amount: 12.5, currency: 'EUR' })
            ]
        });
        api.json('DELETE core /bodies/:id/payments/:payment_id', ok({}));

        await page.goto('/bodies/1/members');
        const memberRow = rowOf(page, 'Ann <b>Able</b>');
        await expect(await cellOf(membersTable(page), memberRow, 'Last payment exp. date')).toHaveText('2027-01-01');
        await memberRow.getByRole('button', { name: 'View or manage payments' }).click();
        const modal = dialog(page, 'Fee payments for Ann <b>Able</b>');
        const latest = tableRows(modal.getByRole('table')).filter({ hasText: '502' });
        await latest.getByRole('button', { name: 'Delete' }).click();

        const confirm = dialog(page, 'Deleting a fee');
        await expect(confirm).toContainText('Are you sure you want to delete the payment of 12.5 EUR (2026-01-01 to 2027-01-01) from Ann <b>Able</b>? This action cannot be undone.');
        await confirm.getByRole('button', { name: 'Cancel' }).click();
        await expect(confirm).toBeHidden();
        expect(api.callsTo('DELETE core /bodies/:id/payments/:payment_id')).toHaveLength(0);

        await latest.getByRole('button', { name: 'Delete' }).click();
        await dialog(page, 'Deleting a fee').getByRole('button', { name: 'Delete fee' }).click();

        await expect(toast(page, 'Fee is deleted.')).toBeVisible();
        await expect(tableRows(modal.getByRole('table'))).toHaveCount(1);
        await expect.poll(() => api.callsTo('DELETE core /bodies/:id/payments/:payment_id').map((call) => call.params)).toEqual([{ id: '1', payment_id: '502' }]);
        await modal.getByRole('button', { name: 'close' }).click();
        await expect(await cellOf(membersTable(page), memberRow, 'Last payment exp. date')).toHaveText('2026-01-01');
    });

    test('says why a payment could not be deleted', async ({ page, api }) => {
        answer(api, { payments: [payment({ id: 501, user_id: 31, body_id: 1 })] });
        api.on('DELETE core /bodies/:id/payments/:payment_id', { status: 403, json: { success: false, message: 'Permission delete:payment is required, but not present.' } });

        await page.goto('/bodies/1/members');
        await rowOf(page, 'Ann Able').getByRole('button', { name: 'View or manage payments' }).click();
        const modal = dialog(page, 'Fee payments for Ann Able');
        await modal.getByRole('button', { name: 'Delete' }).click();
        await dialog(page, 'Deleting a fee').getByRole('button', { name: 'Delete fee' }).click();

        await expect(toast(page, 'Could not delete fee: Permission delete:payment is required, but not present.')).toBeVisible();
        await expect(tableRows(modal.getByRole('table'))).toHaveCount(1);
    });
});

test.describe('adding a fee payment', () => {
    test('starts today for a year and adds the payment', async ({ page, api }) => {
        await freezeTime(page);
        answer(api);
        api.json('POST core /bodies/:id/payments', ok(payment({ id: 601, user_id: 31, body_id: 1, starts: '2027-03-10', expires: '2028-03-10', amount: 25, currency: 'EU', created_at: iso(0, Date.parse(FIXED_NOW)) })));

        await page.goto('/bodies/1/members');
        await rowOf(page, 'Ann Able').getByRole('button', { name: 'Add fee payment' }).click();
        const modal = dialog(page, 'Add fee payment for Ann Able');
        await expect(modal.getByText('Add fee payment for Ann Able')).toBeVisible();
        await expect(modal.getByLabel('Starts at')).toHaveValue('2027-03-01');
        await expect(modal.getByLabel('Expires on')).toHaveValue('2028-03-01');

        await fillDate(modal.getByLabel('Starts at'), '2027-03-10');
        await expect(modal.getByLabel('Expires on')).toHaveValue('2028-03-10');
        await modal.getByLabel('Amount').fill('25');
        await modal.getByLabel('Currency').selectOption('Euro');
        await modal.getByLabel('Invoice address').fill('Main street 1');
        await modal.getByLabel('Invoice name').fill('A. Able');
        await modal.getByRole('button', { name: 'Add fee payment' }).click();

        await expect(toast(page, 'Payment is added.')).toBeVisible();
        await expect(modal).toBeHidden();
        await expect(await cellOf(membersTable(page), rowOf(page, 'Ann Able'), 'Last payment exp. date')).toHaveText('2028-03-10');
        await expect.poll(() => api.callsTo('POST core /bodies/:id/payments').map((call) => [call.params, call.body])).toEqual([[{ id: '1' }, {
            starts: '2027-03-10',
            expires: '2028-03-10',
            currency: 'EU',
            amount: 25,
            invoice_address: 'Main street 1',
            invoice_name: 'A. Able',
            user_id: 31,
            body_id: 1
        }]]);
    });

    test('closes without adding a payment', async ({ page, api }) => {
        answer(api);

        await page.goto('/bodies/1/members');
        await rowOf(page, 'Ann Able').getByRole('button', { name: 'Add fee payment' }).click();
        await dialog(page, 'Add fee payment for Ann Able').getByRole('button', { name: 'Cancel' }).click();

        await expect(dialog(page, 'Add fee payment for Ann Able')).toBeHidden();
        expect(api.callsTo('POST core /bodies/:id/payments')).toHaveLength(0);
    });

    test('keeps invoice details that look like numbers as they were typed', async ({ page, api }) => {
        answer(api);
        api.json('POST core /bodies/:id/payments', ok(payment({ user_id: 31, body_id: 1 })));

        await page.goto('/bodies/1/members');
        await rowOf(page, 'Ann Able').getByRole('button', { name: 'Add fee payment' }).click();
        const modal = dialog(page, 'Add fee payment for Ann Able');
        await modal.getByLabel('Invoice address').fill('0123');
        await modal.getByLabel('Invoice name').fill('007');
        await modal.getByRole('button', { name: 'Add fee payment' }).click();

        await expect(toast(page, 'Payment is added.')).toBeVisible();
        await expect.poll(() => api.callsTo('POST core /bodies/:id/payments')[0].body).toMatchObject({ invoice_address: '0123', invoice_name: '007' });
    });

    test('clearing the start keeps the expiry date', async ({ page, api }) => {
        await freezeTime(page);
        answer(api);

        await page.goto('/bodies/1/members');
        await rowOf(page, 'Ann Able').getByRole('button', { name: 'Add fee payment' }).click();
        const modal = dialog(page, 'Add fee payment for Ann Able');
        await expect(modal.getByLabel('Expires on')).toHaveValue('2028-03-01');
        await fillDate(modal.getByLabel('Starts at'), '');

        await expect(modal.getByLabel('Starts at')).toHaveValue('');
        await expect(modal.getByLabel('Expires on')).toHaveValue('2028-03-01');
    });

    test('can be sent only once while it is being saved', async ({ page, api }) => {
        answer(api);
        api.on('POST core /bodies/:id/payments', { json: ok(payment({ user_id: 31, body_id: 1 })), delayMs: 1000 });

        await page.goto('/bodies/1/members');
        await rowOf(page, 'Ann Able').getByRole('button', { name: 'Add fee payment' }).click();
        const modal = dialog(page, 'Add fee payment for Ann Able');
        await modal.getByRole('button', { name: 'Add fee payment' }).click();

        await expect(modal.getByRole('button', { name: 'Add fee payment' })).toBeDisabled();
        await expect(toast(page, 'Payment is added.')).toBeVisible();
        await expect.poll(() => api.callsTo('POST core /bodies/:id/payments')).toHaveLength(1);
    });

    test('shows what the service objects to', async ({ page, api }) => {
        answer(api);
        api.on('POST core /bodies/:id/payments', {
            status: 422,
            json: validationError({
                starts: ['Starts date should be set.'],
                expires: ['Expiration date should be set.'],
                currency: ['Currency should be set.'],
                amount: ['Amount cannot be negative.'],
                invoice_address: ['Invoice address is too long.'],
                invoice_name: ['Invoice name is too long.']
            })
        });

        await page.goto('/bodies/1/members');
        await rowOf(page, 'Ann Able').getByRole('button', { name: 'Add fee payment' }).click();
        const modal = dialog(page, 'Add fee payment for Ann Able');
        await modal.getByRole('button', { name: 'Add fee payment' }).click();

        await expect(toast(page, 'Some fields were not set')).toBeVisible();
        await expect(modal.getByText('Currency should be set.')).toBeVisible();
        await expect(modal.getByText('Amount cannot be negative.')).toBeVisible();
        for (const message of ['Starts date should be set.', 'Expiration date should be set.', 'Invoice address is too long.', 'Invoice name is too long.']) {
            await expect(modal.getByText(message), message).toBeVisible();
        }
        await expect(modal.getByRole('button', { name: 'Add fee payment' })).toBeEnabled();
    });

    test('says why the payment could not be added and stays open', async ({ page, api }) => {
        answer(api);
        api.on('POST core /bodies/:id/payments', { status: 500, json: { success: false, message: 'Database is down' } });

        await page.goto('/bodies/1/members');
        await rowOf(page, 'Ann Able').getByRole('button', { name: 'Add fee payment' }).click();
        const modal = dialog(page, 'Add fee payment for Ann Able');
        await modal.getByRole('button', { name: 'Add fee payment' }).click();

        await expect(toast(page, 'Some error happened: Database is down')).toBeVisible();
        await expect(modal).toBeVisible();
    });

    test('those who may add but not see payments can add one and list it', async ({ page, api }) => {
        answer(api, { permissions: ['local:create:payment'] });
        api.json('POST core /bodies/:id/payments', ok(payment({ id: 601, user_id: 31, body_id: 1, starts: '2027-01-01', expires: '2028-01-01' })));

        await page.goto('/bodies/1/members');
        await rowOf(page, 'Ann Able').getByRole('button', { name: 'View or manage payments' }).click();
        const list = dialog(page, 'Fee payments for Ann Able');
        await expect(list.getByText('Nothing here.')).toBeVisible();
        await list.getByRole('button', { name: 'close' }).click();
        await expect(list).toBeHidden();

        await rowOf(page, 'Ann Able').getByRole('button', { name: 'Add fee payment' }).click();
        const modal = dialog(page, 'Add fee payment for Ann Able');
        await modal.getByRole('button', { name: 'Add fee payment' }).click();

        await expect(toast(page, 'Payment is added.')).toBeVisible();
        await expect(modal).toBeHidden();
        await expect(toast(page, 'Some error happened')).toHaveCount(0);
        await rowOf(page, 'Ann Able').getByRole('button', { name: 'View or manage payments' }).click();
        await expect(tableRows(dialog(page, 'Fee payments for Ann Able').getByRole('table'))).toHaveCount(1);
        expect(api.callsTo('GET core /bodies/:id/payments')).toHaveLength(0);
    });
});
