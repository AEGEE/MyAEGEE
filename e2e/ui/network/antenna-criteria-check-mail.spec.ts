// The other dialogs of the Antenna Criteria page (/network/ac_check): the comments on a Local's
// criteria, and, for holders of global:manage_network:fulfilment_email, the texts of an Agora's
// fulfilment mail and the mail itself, built from the parts for the criteria a Local misses.
import type { Page } from '@playwright/test';

import { ok } from '../support/factories/base.ts';
import { body } from '../support/factories/core.ts';
import { allMailComponents, antennaCriterion, mailComponent, netcomAssignment, type AntennaCriterionName } from '../support/factories/network.ts';
import { SPRING_AGORA, acCheck, memberslist, mockAcCheck, netcommie, networkManager } from '../support/network-helpers.ts';
import { dialog, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const ALPHA = body({ id: 11, name: 'AEGEE-Alpha', type: 'antenna' });
const BETA = body({ id: 12, name: 'AEGEE-Beta', type: 'contact antenna', email: 'board@aegee-beta.org' });
const NORA = netcommie(41, 'Nora', { gsuite: 'nora@aegee.eu' });
const OTTO = netcommie(42, 'Otto', { email: 'otto@example.com' });

const criterion = (bodyId: number, name: AntennaCriterionName, value: 'true' | 'false' | 'exception' | null, comment: string | null = null) => antennaCriterion({
    agora_id: SPRING_AGORA.id, body_id: bodyId, antenna_criterion: name, value, comment
});

const TEXTS = allMailComponents(SPRING_AGORA.id, {
    introduction: 'Dear board of {body_name} ({local_type}),',
    communication: 'Please answer the mails of {netcom_name}.',
    'members list': 'Your members list is missing.',
    'membership fee': 'Your fee is <r>not paid</r>.',
    closing: 'You need {antenna_criteria_amount} criteria for the **{agora_name}**.'
});

const DEFAULT = {
    bodies: [ALPHA, BETA],
    netcommies: [NORA, OTTO],
    assignments: [netcomAssignment({ body_id: ALPHA.id, netcom_id: NORA.user_id }), netcomAssignment({ body_id: BETA.id, netcom_id: OTTO.user_id })],
    // Beta, a contact antenna, misses communication and the fee: its members list is in.
    memberslists: [memberslist({ event_id: SPRING_AGORA.id, body_id: BETA.id, fee_not_paid: 25 })],
    criteria: [
        criterion(ALPHA.id, 'communication', 'true', 'Answers every mail'),
        criterion(ALPHA.id, 'board election', 'exception', 'Elections moved to May'),
        criterion(ALPHA.id, 'members list', null, ''),
        criterion(BETA.id, 'communication', 'false')
    ],
    mailComponents: TEXTS
};

const loaded = async (page: Page): Promise<void> => {
    await page.goto('/network/ac_check');
    await expect(acCheck(page)).not.toHaveAttribute('aria-busy');
};

test.describe('the comments and the fulfilment mail of the Antenna Criteria', () => {
    test.beforeEach(({ myPermissions }) => {
        myPermissions.splice(0, myPermissions.length, ...networkManager());
    });

    test('the eye button lists the comments on a Local\'s criteria', async ({ page, api }) => {
        mockAcCheck(api, DEFAULT);

        await loaded(page);
        await acCheck(page).getByRole('button', { name: 'Show comments for AEGEE-Alpha' }).click();

        const comments = dialog(page, 'Comments for AEGEE-Alpha');
        await expect(comments).toContainText('Communication: Answers every mail');
        await expect(comments).toContainText('Board election: Elections moved to May');
        await expect(comments).not.toContainText('Members list');
        await expect(comments).not.toContainText('No comments to display');
        await comments.getByRole('button', { name: 'close' }).click();
        await expect(comments).toHaveCount(0);
    });

    test('a Local without comments says so', async ({ page, api }) => {
        mockAcCheck(api, DEFAULT);

        await loaded(page);
        await acCheck(page).getByRole('button', { name: 'Show comments for AEGEE-Beta' }).click();

        await expect(dialog(page, 'Comments for AEGEE-Beta')).toContainText('No comments to display for this body!');
    });

    test('the mail texts dialog shows the Agora\'s texts and a preview of the whole mail', async ({ page, api }) => {
        mockAcCheck(api, DEFAULT);

        await loaded(page);
        await acCheck(page).getByRole('button', { name: 'Change fulfilment email text' }).click();

        const texts = dialog(page, 'Change fulfilment email text');
        await expect(texts.getByLabel('Introduction text')).toHaveValue('Dear board of {body_name} ({local_type}),');
        await expect(texts.getByLabel('Communication', { exact: true })).toHaveValue('Please answer the mails of {netcom_name}.');
        await expect(texts.getByLabel('Membership fee')).toHaveValue('Your fee is <r>not paid</r>.');
        await expect(texts.getByLabel('Fulfilment Report')).toHaveValue('fulfilment report text');
        await expect(texts.getByLabel('Closing')).toHaveValue('You need {antenna_criteria_amount} criteria for the **{agora_name}**.');
        await expect(texts.getByRole('strong').filter({ hasText: '{agora_name}' })).toBeVisible();
        await expect(texts.getByText('not paid', { exact: true })).toHaveCSS('color', 'rgb(255, 0, 0)');

        await texts.getByLabel('Events').fill('Organise an event, *any* <r>event</r>.');
        await expect(texts.getByRole('emphasis').filter({ hasText: 'any' })).toBeVisible();
        await expect(texts.getByText('event', { exact: true })).toHaveCSS('color', 'rgb(255, 0, 0)');
    });

    test('saving the mail texts sends the changed ones and takes the new texts', async ({ page, api }) => {
        mockAcCheck(api, DEFAULT);
        api.on('PUT network /mailComponent', ({ body: sent }) => ({ json: ok(mailComponent(sent as object)) }));

        await loaded(page);
        await acCheck(page).getByRole('button', { name: 'Change fulfilment email text' }).click();
        const texts = dialog(page, 'Change fulfilment email text');
        await texts.getByLabel('Closing').fill('Kind regards, {netcom_name}');
        await texts.getByLabel('Agora attendance').fill('');
        await texts.getByRole('button', { name: 'Save' }).click();

        await expect(toast(page, 'Mail components updated.')).toBeVisible();
        await expect(texts).toHaveCount(0);
        expect(api.callsTo('PUT network /mailComponent').map((call) => call.body)).toEqual([
            { agora_id: 7, mail_component: 'agora attendance', text: '' },
            { agora_id: 7, mail_component: 'closing', text: 'Kind regards, {netcom_name}' }
        ]);
        // The texts are asked for again, without loading the page anew.
        await expect.poll(() => api.callsTo('GET network /mailComponent/:agora_id')).toHaveLength(2);
        expect(api.callsTo('GET statutory /')).toHaveLength(1);
    });

    test('a text that cannot be saved shows the error and keeps the dialog', async ({ page, api }) => {
        mockAcCheck(api, DEFAULT);
        api.on('PUT network /mailComponent', { status: 422, json: { success: false, message: 'This is not a valid mail component.' } });

        await loaded(page);
        await acCheck(page).getByRole('button', { name: 'Change fulfilment email text' }).click();
        const texts = dialog(page, 'Change fulfilment email text');
        await texts.getByLabel('Closing').fill('Kind regards');
        await texts.getByRole('button', { name: 'Save' }).click();

        await expect(toast(page, 'Error saving mail component: This is not a valid mail component.')).toBeVisible();
        await expect(texts).toBeVisible();
        await expect(toast(page, 'Mail components updated.')).toHaveCount(0);
        expect(api.callsTo('GET statutory /')).toHaveLength(1);
    });

    test('the mail texts can be written when they could not be loaded', async ({ page, api }) => {
        mockAcCheck(api, { ...DEFAULT, override: { 'GET network /mailComponent/:agora_id': { status: 500, json: { success: false, message: 'Down' } } } });
        api.on('PUT network /mailComponent', ({ body: sent }) => ({ json: ok(mailComponent(sent as object)) }));

        await loaded(page);
        await expect(toast(page, 'Could not fetch mail components: Down')).toBeVisible();
        await acCheck(page).getByRole('button', { name: 'Change fulfilment email text' }).click();
        const texts = dialog(page, 'Change fulfilment email text');
        await expect(texts.getByLabel('Introduction text')).toHaveValue('');
        await texts.getByLabel('Introduction text').fill('Dear board,');
        await texts.getByRole('button', { name: 'Save' }).click();

        await expect(toast(page, 'Mail components updated.')).toBeVisible();
        expect(api.callsTo('PUT network /mailComponent').map((call) => call.body)).toEqual([
            { agora_id: 7, mail_component: 'introduction', text: 'Dear board,' }
        ]);
    });

    test('the send dialog is filled in with the Local\'s addresses and the parts for the criteria it misses', async ({ page, api }) => {
        mockAcCheck(api, DEFAULT);

        await loaded(page);
        await acCheck(page).getByRole('button', { name: 'Send fulfilment mail to AEGEE-Beta' }).click();

        const mail = dialog(page, 'Fulfilment mail to AEGEE-Beta');
        await expect(mail.getByLabel('From')).toHaveValue('network@aegee.eu');
        await expect(mail.getByLabel('To')).toHaveValue('board@aegee-beta.org');
        await expect(mail.getByLabel('Cc')).toHaveValue('otto@example.com');
        await expect(mail.getByLabel('Subject')).toHaveValue('Preliminary Antenna Criteria check Agora Spring 2027');
        // Communication and the fee, not the members list, which is in.
        await expect(mail.getByLabel('Mail text')).toHaveValue([
            'Dear board of AEGEE-Beta (Contact Antenna),',
            'Please answer the mails of Otto.',
            'Your fee is <r>not paid</r>.',
            'You need 3 criteria for the **Agora Spring 2027**.'
        ].join('\n<br><br>\n'));
        await expect(mail.getByText('not paid', { exact: true })).toHaveCSS('color', 'rgb(255, 0, 0)');
    });

    test('the NetCommie\'s Workspace address goes in Cc where they have one', async ({ page, api }) => {
        mockAcCheck(api, DEFAULT);

        await loaded(page);
        await acCheck(page).getByRole('button', { name: 'Send fulfilment mail to AEGEE-Alpha' }).click();

        const mail = dialog(page, 'Fulfilment mail to AEGEE-Alpha');
        await expect(mail.getByLabel('Cc')).toHaveValue('nora@aegee.eu');
        await expect(mail.getByLabel('Mail text')).toHaveValue(/^Dear board of AEGEE-Alpha \(Antenna\),/);
        await expect(mail.getByLabel('Mail text')).toHaveValue(/You need 8 criteria/);
    });

    test('sending posts the mail as edited, with the sender as reply-to and the text as HTML', async ({ page, api }) => {
        mockAcCheck(api, DEFAULT);
        api.json('POST network /antennaCriteria/sendFulfilmentMail', { success: true, message: 'Mail sent.' });

        await loaded(page);
        await acCheck(page).getByRole('button', { name: 'Send fulfilment mail to AEGEE-Beta' }).click();
        const mail = dialog(page, 'Fulfilment mail to AEGEE-Beta');
        await mail.getByLabel('From').fill('netcom@aegee.org');
        await mail.getByLabel('Cc').fill('otto@aegee.eu, nora@aegee.eu');
        await mail.getByLabel('Subject').fill('Your Antenna Criteria');
        await mail.getByLabel('Mail text').fill('Dear board,\n\nplease send us **your** <r>members list</r>.');
        await expect(mail.getByRole('strong').filter({ hasText: 'your' })).toBeVisible();
        await mail.getByRole('button', { name: 'Send' }).click();

        await expect(toast(page, 'Mail sent successfully.')).toBeVisible();
        await expect(mail).toHaveCount(0);
        const sent = api.callsTo('POST network /antennaCriteria/sendFulfilmentMail').map((call) => call.body as Record<string, string>);
        expect(sent).toHaveLength(1);
        expect(sent[0]).toEqual({
            from: 'netcom@aegee.org',
            to: 'board@aegee-beta.org',
            cc: 'otto@aegee.eu, nora@aegee.eu',
            subject: 'Your Antenna Criteria',
            reply_to: 'netcom@aegee.org',
            body: expect.stringContaining('<strong>your</strong>')
        });
        expect(sent[0].body).toContain('<font color="red">members list</font>');
        expect(sent[0].body).toContain('<p>Dear board,</p>');
    });

    test('a sender that network refuses is shown with network\'s reason, and the dialog stays', async ({ page, api }) => {
        mockAcCheck(api, DEFAULT);
        api.on('POST network /antennaCriteria/sendFulfilmentMail', {
            status: 422,
            json: { success: false, errors: { from: ['The sender must be an address on one of these domains: aegee.org, aegee.eu.'] } }
        });

        await loaded(page);
        await acCheck(page).getByRole('button', { name: 'Send fulfilment mail to AEGEE-Beta' }).click();
        const mail = dialog(page, 'Fulfilment mail to AEGEE-Beta');
        await mail.getByLabel('From').fill('netcom@example.com');
        await mail.getByRole('button', { name: 'Send' }).click();

        await expect(toast(page, /: The sender must be an address on one of these domains: aegee\.org, aegee\.eu\.$/)).toBeVisible();
        await expect(mail).toBeVisible();
        expect(api.callsTo('POST network /antennaCriteria/sendFulfilmentMail').map((call) => (call.body as Record<string, string>).from)).toEqual(['netcom@example.com']);
    });

    test('a mail that cannot be sent shows the error, and the dialog stays', async ({ page, api }) => {
        mockAcCheck(api, DEFAULT);
        api.on('POST network /antennaCriteria/sendFulfilmentMail', { status: 500, json: { success: false, message: 'The mailer is down.' } });

        await loaded(page);
        await acCheck(page).getByRole('button', { name: 'Send fulfilment mail to AEGEE-Beta' }).click();
        const mail = dialog(page, 'Fulfilment mail to AEGEE-Beta');
        await mail.getByRole('button', { name: 'Send' }).click();

        await expect(toast(page, /: The mailer is down\.$/)).toBeVisible();
        await expect(mail).toBeVisible();
        await mail.getByRole('button', { name: 'Cancel' }).click();
        await expect(mail).toHaveCount(0);
    });

    test('a missing text part or a Local without NetCommie still opens the send dialog, with a warning', async ({ page, api }) => {
        mockAcCheck(api, {
            ...DEFAULT,
            netcommies: null,
            override: { 'GET network /netcom': { status: 500, json: { success: false, message: 'Down' } } },
            mailComponents: TEXTS.filter((part) => part.mail_component !== 'membership fee')
        });

        await loaded(page);
        await acCheck(page).getByRole('button', { name: 'Send fulfilment mail to AEGEE-Beta' }).click();

        const mail = dialog(page, 'Fulfilment mail to AEGEE-Beta');
        await expect(mail.getByLabel('Subject')).toHaveValue('Preliminary Antenna Criteria check Agora Spring 2027');
        await expect(mail.getByLabel('Cc')).toHaveValue('');
        await expect(mail).toContainText('No text set for membership fee.');
        await expect(mail.getByLabel('Mail text')).toHaveValue([
            'Dear board of AEGEE-Beta (Contact Antenna),',
            'Please answer the mails of .',
            'You need 3 criteria for the **Agora Spring 2027**.'
        ].join('\n<br><br>\n'));
    });
});
