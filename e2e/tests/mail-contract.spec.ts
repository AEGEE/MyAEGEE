// The fake mailer (support/fake-mailer.ts) checks every mail against the mail contract
// (mailer/contract/mail-templates.json) and answers like the real mailer: 404 for a template
// the contract doesn't list, 422 for a mail that breaks it. The `mailContract` fixture of
// support/api.ts fails any test during which a mail was refused, so every flow of this suite
// that sends mail checks its mails on the way. scripts/fake-mailer.test.ts covers the answers
// in detail; this spec shows the stack is wired to it.
import { url } from '../support/constants.ts';
import { test, expect } from '../support/api.ts';

const confirmEmail = (parameters: Record<string, unknown>) => ({
    to: 'mail-contract-spec@example.com',
    subject: 'Confirm your address',
    template: 'confirm_email.html',
    parameters
});

test.describe('mail contract', () => {
    // statutory sends its mails after the application is saved and only logs a mailer error, so
    // a refused mail would go unnoticed without the fixture's check.
    test('the mails of a statutory application reach the mailer and match the contract', async ({ api }) => {
        const event = await api.createStatutoryEvent();
        const application = await api.applyToStatutory('member', event);

        await expect.poll(async () => (await api.mails()).filter((mail) => mail.template === 'statutory_applied.html'
            && (mail.parameters.application as { id: number }).id === application.id).length, {
            message: 'the statutory_applied mail of this application'
        }).toBe(1);
    });

    test('a mail that breaks the contract is refused with the real mailer\'s answers', async ({ api }) => {
        const mailer = url('mailer');

        const unknown = await api.request.post(`${mailer}/`, { data: { ...confirmEmail({}), template: 'mail_contract_spec_unknown.html' } });
        expect(unknown.status()).toBe(404);
        expect(await unknown.json()).toEqual({ success: false, error: expect.stringMatching(/^Template mail_contract_spec_unknown\.html not found/) });

        const missing = await api.request.post(`${mailer}/`, { data: confirmEmail({ name: 'Ada', surname: 'Lovelace' }) });
        expect(missing.status()).toBe(422);
        expect(await missing.json()).toEqual({ success: false, error: 'Mail breaks the contract: parameters.token: missing' });

        // Both are kept for the fixture, which fails a test that doesn't expect them.
        expect((await api.expectRefusedMail('mail_contract_spec_unknown.html')).status).toBe(404);
        expect((await api.expectRefusedMail('confirm_email.html')).error).toBe('Mail breaks the contract: parameters.token: missing');
        expect((await api.mails()).some((mail) => mail.to === 'mail-contract-spec@example.com')).toBe(false);
    });
});
