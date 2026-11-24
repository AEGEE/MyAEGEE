// The dialog of the Antenna Criteria page (/network/ac_check) where the Network Commission sets
// a Local's criteria by hand, with a comment, and assigns its NetCommie. Each field is there
// for holders of its global:manage_network permission only, which network checks too.
import type { Locator, Page } from '@playwright/test';

import { ok } from '../support/factories/base.ts';
import { body, permission, seedPermissions } from '../support/factories/core.ts';
import { antennaCriterion, netcomAssignment, type AntennaCriterionName } from '../support/factories/network.ts';
import { SPRING_AGORA, acCheck, acTable, mockAcCheck, netcommie, networkManager } from '../support/network-helpers.ts';
import { cellOf, dialog, tableRows, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const ALPHA = body({ id: 11, name: 'AEGEE-Alpha', type: 'antenna' });
const NORA = netcommie(41, 'Nora', { gsuite: 'nora@example.org' });
const OTTO = netcommie(42, 'Otto');

const criterion = (name: AntennaCriterionName, value: 'true' | 'false' | 'exception' | null, comment: string | null = null) => antennaCriterion({
    agora_id: SPRING_AGORA.id, body_id: ALPHA.id, antenna_criterion: name, value, comment
});

const editor = (page: Page): Locator => dialog(page, 'Criteria for AEGEE-Alpha');
const cell = async (page: Page, column: string): Promise<Locator> => cellOf(acTable(page), tableRows(acTable(page)).filter({ hasText: 'AEGEE-Alpha' }), column);

const openEditor = async (page: Page): Promise<Locator> => {
    await page.goto('/network/ac_check');
    await expect(acCheck(page)).not.toHaveAttribute('aria-busy');
    await acCheck(page).getByRole('button', { name: 'Edit criteria for AEGEE-Alpha' }).click();
    await expect(editor(page)).toBeVisible();
    return editor(page);
};

const DEFAULT = {
    bodies: [ALPHA],
    netcommies: [NORA, OTTO],
    assignments: [netcomAssignment({ body_id: ALPHA.id, netcom_id: NORA.user_id })],
    criteria: [criterion('communication', 'true', 'Answers every mail'), criterion('board election', 'exception', 'Elections moved to May')]
};

test.describe('editing the criteria of a Local', () => {
    test.beforeEach(({ myPermissions }) => {
        myPermissions.splice(0, myPermissions.length, ...networkManager());
    });

    test('the pencil button opens a dialog with the Local\'s current values and comments', async ({ page, api }) => {
        mockAcCheck(api, DEFAULT);

        const form = await openEditor(page);

        await expect(form).toContainText('AEGEE-Alpha');
        await expect(form.getByLabel('Assigned NetCommie').getByRole('option')).toHaveText(['Nora', 'Otto', 'Not set']);
        await expect(form.getByLabel('Assigned NetCommie').getByRole('option', { selected: true })).toHaveText('Nora');
        await expect(form.getByLabel('Communication (C)')).toHaveValue('true');
        await expect(form.getByLabel('Communication comment')).toHaveValue('Answers every mail');
        await expect(form.getByLabel('Board Election (BE)')).toHaveValue('exception');
        await expect(form.getByLabel('Board election comment')).toHaveValue('Elections moved to May');
        await expect(form.getByLabel('Members list (ML)')).toHaveValue('null');
        await expect(form.getByLabel('Members list comment')).toHaveValue('');
        for (const label of ['Membership fee (F)', 'Events (E)', 'Agora attendance (AA)', 'Development plan (DP)', 'Fulfilment report (FR)']) {
            await expect(form.getByLabel(label), label).toHaveValue('null');
        }
    });

    test('a field is only there with the permission for it; Exception for communication needs its own', async ({ page, api, myPermissions }) => {
        // What the Network Commission holds in production: communication and the NetCom
        // assignment, without the exception.
        myPermissions.splice(0, myPermissions.length, ...seedPermissions('membersCircle', 'netcomCircle'));
        mockAcCheck(api, { ...DEFAULT, mailComponents: null });

        const form = await openEditor(page);

        await expect(form.getByLabel('Assigned NetCommie')).toBeVisible();
        await expect(form.getByLabel('Communication (C)').getByRole('option')).toHaveText(['Not set', 'Yes', 'No']);
        await expect(form.getByLabel('Communication comment')).toBeVisible();
        for (const label of ['Board Election (BE)', 'Members list (ML)', 'Membership fee (F)', 'Events (E)', 'Agora attendance (AA)', 'Development plan (DP)', 'Fulfilment report (FR)']) {
            await expect(form.getByLabel(label), label).toHaveCount(0);
        }
    });

    test('with communication_exception, Exception can be chosen for communication', async ({ page, api }) => {
        mockAcCheck(api, DEFAULT);

        const form = await openEditor(page);

        await expect(form.getByLabel('Communication (C)').getByRole('option')).toHaveText(['Not set', 'Yes', 'No', 'Exception']);
        await expect(form.getByLabel('Agora attendance (AA)').getByRole('option')).toHaveText(['Not set', 'Yes', 'No', 'Exception']);
    });

    test('the fields worked out by the page say so', async ({ page, api }) => {
        mockAcCheck(api, DEFAULT);

        const form = await openEditor(page);

        await expect(form.getByRole('button', { name: 'More information' })).toHaveCount(4);
        await form.getByRole('button', { name: 'More information' }).first().focus();
        await expect(page.getByRole('tooltip')).toHaveText('This is an automatic field');
    });

    test('saving sends each changed criterion, closes the dialog and shows the new values', async ({ page, api }) => {
        mockAcCheck(api, DEFAULT);
        api.on('PUT network /antennaCriteria', ({ body: sent }) => ({ json: ok(antennaCriterion(sent as object)) }));

        const form = await openEditor(page);
        await form.getByLabel('Communication (C)').selectOption('No');
        await form.getByLabel('Communication comment').fill('Missed two mails');
        await form.getByLabel('Board Election (BE)').selectOption('Not set');
        await form.getByLabel('Development plan comment').fill('Sent in late');
        await form.getByRole('button', { name: 'Save' }).click();

        await expect(toast(page, 'Antenna Criteria fulfilment updated.')).toBeVisible();
        await expect(editor(page)).toHaveCount(0);
        expect(api.callsTo('PUT network /antennaCriteria').map((call) => call.body)).toEqual([
            { agora_id: 7, body_id: 11, antenna_criterion: 'communication', value: 'false', comment: 'Missed two mails' },
            { agora_id: 7, body_id: 11, antenna_criterion: 'board election', value: null, comment: 'Elections moved to May' },
            { agora_id: 7, body_id: 11, antenna_criterion: 'development plan', value: null, comment: 'Sent in late' }
        ]);
        await expect(await cell(page, 'C')).toHaveText('No');
        await expect(await cell(page, 'BE')).toHaveText('Empty');
        await expect(await cell(page, 'NetCom')).toHaveText('Nora');
    });

    test('saving an unchanged dialog sends nothing', async ({ page, api }) => {
        mockAcCheck(api, DEFAULT);

        const form = await openEditor(page);
        await form.getByRole('button', { name: 'Save' }).click();

        await expect(toast(page, 'Antenna Criteria fulfilment updated.')).toBeVisible();
        await expect(editor(page)).toHaveCount(0);
        expect(api.callsTo('* network *').filter((call) => call.method !== 'GET')).toEqual([]);
    });

    test('without any criterion permission the dialog has nothing to change', async ({ page, api, myPermissions }) => {
        myPermissions.splice(0, myPermissions.length, ...seedPermissions('membersCircle'), permission('global:manage_network:antenna_criteria'));
        mockAcCheck(api, { ...DEFAULT, assignments: [], netcommies: null, mailComponents: null, override: { 'GET network /netcom': { status: 403, json: { success: false, message: 'You are not allowed to list NetCom assignment.' } } } });

        const form = await openEditor(page);

        await expect(form.getByRole('combobox')).toHaveCount(0);
        await expect(form.getByRole('textbox')).toHaveCount(0);
        await form.getByRole('button', { name: 'Save' }).click();
        await expect(toast(page, 'Antenna Criteria fulfilment updated.')).toBeVisible();
        expect(api.callsTo('* network *').filter((call) => call.method !== 'GET')).toEqual([]);
    });

    test('choosing another NetCommie assigns them, "Not set" removes the assignment', async ({ page, api }) => {
        mockAcCheck(api, DEFAULT);
        api.on('PUT network /netcom', ({ body: sent }) => ({ json: ok(netcomAssignment(sent as object)) }));
        api.json('DELETE network /netcom/:body_id', { success: true, message: 'NetCom assignment was deleted.' });

        let form = await openEditor(page);
        await form.getByLabel('Assigned NetCommie').selectOption('Otto');
        await form.getByRole('button', { name: 'Save' }).click();

        await expect(toast(page, 'Antenna Criteria fulfilment updated.')).toBeVisible();
        expect(api.callsTo('PUT network /netcom').map((call) => call.body)).toEqual([{ body_id: 11, netcom_id: 42 }]);
        await expect(await cell(page, 'NetCom')).toHaveText('Otto');

        await acCheck(page).getByRole('button', { name: 'Edit criteria for AEGEE-Alpha' }).click();
        form = editor(page);
        await expect(form.getByLabel('Assigned NetCommie').getByRole('option', { selected: true })).toHaveText('Otto');
        await form.getByLabel('Assigned NetCommie').selectOption('Not set');
        await form.getByRole('button', { name: 'Save' }).click();

        await expect(editor(page)).toHaveCount(0);
        expect(api.callsTo('DELETE network /netcom/:body_id').map((call) => call.params)).toEqual([{ body_id: '11' }]);
        await expect(await cell(page, 'NetCom')).toHaveText('Not set');
    });

    test('a failing save shows the error, keeps the dialog open and leaves the row as it was', async ({ page, api }) => {
        mockAcCheck(api, DEFAULT);
        api.on('PUT network /antennaCriteria', { status: 403, json: { success: false, message: 'You are not allowed to set fulfilment of the criterion communication.' } });

        const form = await openEditor(page);
        await form.getByLabel('Communication (C)').selectOption('No');
        await form.getByRole('button', { name: 'Save' }).click();

        await expect(toast(page, 'Error saving Antenna Criteria: You are not allowed to set fulfilment of the criterion communication.')).toBeVisible();
        await expect(editor(page)).toBeVisible();
        await expect(toast(page, 'Antenna Criteria fulfilment updated.')).toHaveCount(0);
        await expect(await cell(page, 'C')).toHaveText('Yes');
    });

    test('a failing NetCom assignment shows the error and keeps the dialog open', async ({ page, api }) => {
        mockAcCheck(api, DEFAULT);
        api.on('PUT network /netcom', { status: 422, json: { success: false, errors: { netcom_id: ['NetCom ID should be a number.'] } } });

        const form = await openEditor(page);
        await form.getByLabel('Assigned NetCommie').selectOption('Otto');
        await form.getByRole('button', { name: 'Save' }).click();

        await expect(toast(page, 'Error saving NetCom: NetCom ID should be a number.')).toBeVisible();
        await expect(editor(page)).toBeVisible();
        await expect(await cell(page, 'NetCom')).toHaveText('Nora');
    });

    test('a comment that is cleared is saved empty', async ({ page, api }) => {
        mockAcCheck(api, DEFAULT);
        api.on('PUT network /antennaCriteria', ({ body: sent }) => ({ json: ok(antennaCriterion(sent as object)) }));

        const form = await openEditor(page);
        await form.getByLabel('Communication comment').fill('');
        await form.getByRole('button', { name: 'Save' }).click();

        await expect(editor(page)).toHaveCount(0);
        expect(api.callsTo('PUT network /antennaCriteria').map((call) => call.body)).toEqual([
            { agora_id: 7, body_id: 11, antenna_criterion: 'communication', value: 'true', comment: '' }
        ]);
    });

    test('of two NetCommies with the same first name, the assigned one is selected', async ({ page, api }) => {
        const otherNora = netcommie(43, 'Nora', { email: 'nora.other@example.com' });
        mockAcCheck(api, { ...DEFAULT, netcommies: [NORA, otherNora], assignments: [netcomAssignment({ body_id: ALPHA.id, netcom_id: otherNora.user_id })] });

        const form = await openEditor(page);
        await form.getByRole('button', { name: 'Save' }).click();

        await expect(editor(page)).toHaveCount(0);
        expect(api.callsTo('* network *').filter((call) => call.method !== 'GET')).toEqual([]);
    });

    test('the dialog opens and saves for a Local without NetCom data', async ({ page, api }) => {
        mockAcCheck(api, { ...DEFAULT, netcommies: null, override: { 'GET network /netcom': { status: 500, json: { success: false, message: 'Down' } } } });
        api.on('PUT network /antennaCriteria', ({ body: sent }) => ({ json: ok(antennaCriterion(sent as object)) }));

        const form = await openEditor(page);
        await form.getByLabel('Events (E)').selectOption('Yes');
        await form.getByRole('button', { name: 'Save' }).click();

        await expect(toast(page, 'Antenna Criteria fulfilment updated.')).toBeVisible();
        expect(api.callsTo('PUT network /antennaCriteria').map((call) => call.body)).toEqual([
            { agora_id: 7, body_id: 11, antenna_criterion: 'events', value: 'true', comment: '' }
        ]);
        expect(api.callsTo('* network *').filter((call) => call.method !== 'GET' && call.path.startsWith('/netcom'))).toEqual([]);
    });

    test('closing the dialog or cancelling sends nothing', async ({ page, api }) => {
        mockAcCheck(api, DEFAULT);

        let form = await openEditor(page);
        await form.getByLabel('Communication (C)').selectOption('No');
        await form.getByRole('button', { name: 'Cancel' }).click();
        await expect(editor(page)).toHaveCount(0);

        await acCheck(page).getByRole('button', { name: 'Edit criteria for AEGEE-Alpha' }).click();
        form = editor(page);
        await form.getByLabel('Communication (C)').selectOption('No');
        await form.getByRole('button', { name: 'close' }).click();
        await expect(editor(page)).toHaveCount(0);

        await expect(await cell(page, 'C')).toHaveText('Yes');
        expect(api.callsTo('* network *').filter((call) => call.method !== 'GET')).toEqual([]);
    });
});
