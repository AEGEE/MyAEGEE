// Mass mailer of a statutory event (/statutory/:id/massmailer): a mail to the applicants that
// match a filter, written in markdown with placeholders for each applicant's data.
import type { Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { badRequest, forbidden, notFound, ok } from '../support/factories/base.ts';
import { massmailerResult, statutoryEvent, statutoryEventPermissions } from '../support/factories/statutory-events.ts';
import { toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const showEvent = (api: ApiMock, useMassmailer = true): void => {
    api.json('GET statutory /events/:id', ok(statutoryEvent({ id: 5, url: 'agora-spring', permissions: statutoryEventPermissions({ use_massmailer: useMassmailer }) })));
};

const write = async (page: Page, { replyTo = 'board@example.org', subject = 'Your Agora', text = 'Dear {first_name},\n\nsee you **soon**.' } = {}): Promise<void> => {
    await page.getByLabel('Address to reply to').fill(replyTo);
    await page.getByLabel('Email subject').fill(subject);
    await page.getByLabel('Type the email text here').fill(text);
};

test.describe('statutory mass mailer', () => {
    test('mails the applicants that match the filters, after a preview with sample data', async ({ page, api }) => {
        showEvent(api);
        api.json('POST statutory /events/:id/massmailer', massmailerResult(3));

        await page.goto('/statutory/agora-spring/massmailer');
        await expect(page.getByRole('heading', { name: 'Mass mailer' })).toBeVisible();
        await expect(page).toHaveTitle('MyAEGEE | Massmailer for statutory events');

        await page.getByLabel('Filter on participant status').selectOption({ label: 'Accepted participants' });
        await page.getByLabel('Filter on confirmation').selectOption({ label: 'Not confirmed participants' });
        await page.getByLabel('Filter on incoming form filled (LO)').selectOption({ label: 'Participants that did fill incoming form' });
        await page.getByLabel('Filter on participant type').selectOption({ label: 'Delegate' });
        await write(page, { text: 'Dear {first_name} {LAST_NAME} of {body_name} ({statutory_id}, {participant_type_order}),\n\nsee you **soon**.' });

        const preview = page.getByRole('region', { name: 'Preview:' });
        await expect(preview).toContainText('Dear Name Surname of AEGEE-Europe (001-0001, delegate (1)),');
        await expect(preview.getByText('soon')).toHaveJSProperty('tagName', 'STRONG');

        await page.getByRole('button', { name: 'Send mail' }).click();

        await expect(toast(page, 'Mass mailer is sent successfully to 3 participants.')).toBeVisible();
        // The page's address, and the text rendered from markdown with the placeholders left for the service.
        expect(api.callsTo('POST statutory /events/:id/massmailer').map((call) => [call.params.id, call.body])).toEqual([['agora-spring', {
            subject: 'Your Agora',
            reply_to: 'board@example.org',
            text: '<div class="markdown"><p>Dear {first_name} {LAST_NAME} of {body_name} ({statutory_id}, {participant_type_order}),</p>\n<p>see you <strong>soon</strong>.</p>\n</div>',
            filter: { status: 'accepted', confirmed: false, incoming: true, participant_type: 'delegate' }
        }]]);
    });

    test('without filters the mail goes to everybody', async ({ page, api }) => {
        showEvent(api);
        api.json('POST statutory /events/:id/massmailer', massmailerResult(12));

        await page.goto('/statutory/agora-spring/massmailer');
        await page.getByLabel('Filter on confirmation').selectOption({ label: 'Confirmed participants' });
        await page.getByLabel('Filter on confirmation').selectOption({ label: 'Everybody' });
        await write(page);
        await page.getByRole('button', { name: 'Send mail' }).click();

        await expect(toast(page, 'Mass mailer is sent successfully to 12 participants.')).toBeVisible();
        expect(api.callsTo('POST statutory /events/:id/massmailer').map((call) => (call.body as { filter: object }).filter)).toEqual([{}]);
    });

    test('"Send mail" waits for the answer', async ({ page, api }) => {
        showEvent(api);
        api.on('POST statutory /events/:id/massmailer', { json: massmailerResult(1), delayMs: 1000 });

        await page.goto('/statutory/agora-spring/massmailer');
        await write(page);
        await page.getByRole('button', { name: 'Send mail' }).click();

        await expect(page.getByRole('button', { name: 'Send mail' })).toBeDisabled();
        await expect(toast(page, 'Mass mailer is sent successfully to 1 participants.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Send mail' })).toBeEnabled();
    });

    test('the browser asks for the reply address, the subject and the text first', async ({ page, api }) => {
        showEvent(api);
        await page.goto('/statutory/agora-spring/massmailer');
        const send = page.getByRole('button', { name: 'Send mail' });
        const validity = (label: string, check: 'valueMissing' | 'typeMismatch') => page.getByLabel(label).evaluate((field: HTMLInputElement, what) => field.validity[what], check);

        await send.click();
        expect(await validity('Address to reply to', 'valueMissing')).toBe(true);

        await page.getByLabel('Address to reply to').fill('the board');
        await send.click();
        expect(await validity('Address to reply to', 'typeMismatch')).toBe(true);

        await page.getByLabel('Address to reply to').fill('board@example.org');
        await send.click();
        expect(await validity('Email subject', 'valueMissing')).toBe(true);

        await page.getByLabel('Email subject').fill('Your Agora');
        await send.click();
        expect(await validity('Type the email text here', 'valueMissing')).toBe(true);

        expect(api.callsTo('POST statutory /events/:id/massmailer')).toEqual([]);
    });

    test('a text of only spaces is no mail', async ({ page, api }) => {
        showEvent(api);
        await page.goto('/statutory/agora-spring/massmailer');

        await write(page, { text: '   \n  ' });
        await page.getByRole('button', { name: 'Send mail' }).click();

        await expect(toast(page, 'Please type the email text.')).toBeVisible();
        expect(api.callsTo('POST statutory /events/:id/massmailer')).toEqual([]);
    });

    for (const [status, answer, message] of [
        [400, badRequest('No users match this filter.'), 'Error using massmailer: No users match this filter.'],
        [403, forbidden('You cannot access massmailer.'), 'Error using massmailer: You cannot access massmailer.']
    ] as const) {
        test(`a refused mail (${status}) says why`, async ({ page, api }) => {
            showEvent(api);
            api.on('POST statutory /events/:id/massmailer', { status, json: answer });

            await page.goto('/statutory/agora-spring/massmailer');
            await write(page);
            await page.getByRole('button', { name: 'Send mail' }).click();

            await expect(toast(page, message)).toBeVisible();
            await expect(page.getByLabel('Email subject')).toHaveValue('Your Agora');
        });
    }

    test('a member who may not use the mass mailer is told so, without the form', async ({ page, api }) => {
        showEvent(api, false);

        await page.goto('/statutory/agora-spring/massmailer');

        await expect(page.getByText('You are not allowed to use the mass mailer of this event.')).toBeVisible();
        await expect(page.getByLabel('Email subject')).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Send mail' })).toHaveCount(0);
    });

    test('an unknown event goes back to the list', async ({ page, api }) => {
        api.on('GET statutory /events/:id', { status: 404, json: notFound('Event with such url or ID is not found.') });
        api.json('GET statutory /', ok([]));

        await page.goto('/statutory/no-such-event/massmailer');

        await expect(toast(page, 'Event is not found')).toBeVisible();
        await expect(page).toHaveURL('/statutory');
    });

    test('a failing service goes back to the list', async ({ page, api }) => {
        api.on('GET statutory /events/:id', { status: 500, json: { success: false, message: 'Database is down' } });
        api.json('GET statutory /', ok([]));

        await page.goto('/statutory/agora-spring/massmailer');

        await expect(toast(page, 'Some error happened: Database is down')).toBeVisible();
        await expect(page).toHaveURL('/statutory');
    });

    test('the preview shows markdown without running scripts', async ({ page, api }) => {
        showEvent(api);
        const picture = new Promise<void>((resolve) => {
            api.url('GET', '/statutory/agora-spring/x', () => {
                resolve();
                return { status: 404, body: '' };
            });
        });
        await page.goto('/statutory/agora-spring/massmailer');

        await page.getByLabel('Type the email text here').fill('**bold** <img src=x onerror="window.__xss=1"><script>window.__xss=2</script> [x](javascript:window.__xss=3)');

        const preview = page.getByRole('region', { name: 'Preview:' });
        await expect(preview.getByText('bold', { exact: true })).toHaveJSProperty('tagName', 'STRONG');
        await expect(preview.getByText('x', { exact: true })).not.toHaveAttribute('href', /javascript:/);
        await picture;
        expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    });
});
