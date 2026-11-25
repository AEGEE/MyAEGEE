// The fake mailer of the real-stack suite (support/fake-mailer.ts) answers like the real mailer:
// 404 for a template the mail contract doesn't list, 422 for a mail that breaks the contract,
// 200 otherwise, and keeps what it refused for the `mailContract` fixture.
// Run: node --test scripts/*.test.ts   (part of `npm run lint`)
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type http from 'node:http';
import { after, before, describe, test } from 'node:test';

// The mail contract lives with the mailer; its checker has no dependencies, so it is loaded
// from its place in the repository, as the services' jest suites do.
// eslint-disable-next-line import/no-relative-packages -- the contract is a file of the mailer, not a dependency
import { loadManifest } from '../../mailer/contract/check-mail.cjs';
import { createFakeMailer, type RefusedMail } from '../support/fake-mailer.ts';

const manifest = loadManifest();

const confirmEmail = (parameters: Record<string, unknown>) => ({
    to: 'ada@example.com',
    subject: 'Confirm your address',
    template: 'confirm_email.html',
    parameters
});
const VALID_PARAMETERS = { name: 'Ada', surname: 'Lovelace', token: 'Xq3vK9pLm2Rt8sYw' };

const without = (object: Record<string, unknown>, ...keys: string[]): Record<string, unknown> => Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key)));

describe('the fake mailer', () => {
    let server: http.Server;
    let base: string;

    before(async () => {
        server = createFakeMailer({ log: () => {} });
        await new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', resolve); });
        base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });

    after(() => new Promise<void>((resolve) => { server.close(() => resolve()); }));

    const post = async (body: unknown): Promise<{ status: number; body: { success: boolean; error?: string } }> => {
        const res = await fetch(`${base}/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });
        return { status: res.status, body: await res.json() };
    };
    const get = async <T>(path: string): Promise<T> => ((await (await fetch(`${base}${path}`)).json()) as { data: T }).data;
    const lastRefused = async (): Promise<RefusedMail> => (await get<RefusedMail[]>('/__mails/refused')).at(-1)!;

    test('accepts a mail that matches the contract, with or without .html, and lists it', async () => {
        assert.deepEqual(await post(confirmEmail(VALID_PARAMETERS)), { status: 200, body: { success: true } });
        assert.equal((await post({ ...confirmEmail(VALID_PARAMETERS), template: 'confirm_email' })).status, 200);

        const mails = await get<{ template: string; received_at: string }[]>('/__mails');
        assert.deepEqual(mails.map((mail) => mail.template), ['confirm_email.html', 'confirm_email']);
        assert.ok(mails.every((mail) => typeof mail.received_at === 'string'));
    });

    test('accepts every example of the contract', async () => {
        for (const [name, entry] of Object.entries(manifest.templates)) {
            for (const example of entry.examples) {
                const recipients = Array.isArray(example.parameters) ? (example.parameters as unknown[]).map((_, i) => `member${i}@example.com`) : 'member@example.com';
                const answer = await post({ to: recipients, subject: 'Subject', template: `${name}.html`, parameters: example.parameters });
                assert.equal(answer.status, 200, `${name} (${example.name}): ${answer.body.error}`);
            }
        }
    });

    test('answers 404 for a template the contract does not list, and keeps the mail', async () => {
        const mail = { ...confirmEmail(VALID_PARAMETERS), template: 'no_such_template.html' };
        assert.deepEqual(await post(mail), {
            status: 404,
            body: { success: false, error: 'Template no_such_template.html not found (the mail contract does not list it)' }
        });

        const refused = await lastRefused();
        assert.equal(refused.status, 404);
        assert.equal(refused.template, 'no_such_template.html');
        assert.deepEqual(refused.mail, mail);
    });

    test('answers 422 for a missing required parameter, naming every problem', async () => {
        assert.deepEqual(await post(confirmEmail(without(VALID_PARAMETERS, 'token', 'surname'))), {
            status: 422,
            body: { success: false, error: 'Mail breaks the contract: parameters.surname: missing; parameters.token: missing' }
        });
        assert.equal((await lastRefused()).status, 422);
    });

    test('answers 422 for a parameter of the wrong type', async () => {
        const answer = await post(confirmEmail({ ...VALID_PARAMETERS, name: { first: 'Ada' } }));
        assert.deepEqual(answer, { status: 422, body: { success: false, error: 'Mail breaks the contract: parameters.name: expected string, got object' } });
    });

    test('answers 422, not 404, when a field the mailer checks first is missing', async () => {
        const mail = without({ ...confirmEmail(VALID_PARAMETERS), template: 'no_such_template.html' }, 'subject');
        assert.deepEqual(await post(mail), { status: 422, body: { success: false, error: 'Mail breaks the contract: subject: missing' } });
    });

    test('answers 422 for an empty recipient list and for parameters that are not an object', async () => {
        assert.equal((await post({ ...confirmEmail(VALID_PARAMETERS), to: [] })).status, 422);
        assert.match((await post({ ...confirmEmail(VALID_PARAMETERS), parameters: 'token' })).body.error!, /^Mail breaks the contract: parameters: expected object or array/);
        assert.equal((await post([confirmEmail(VALID_PARAMETERS)])).status, 422);
    });

    test('answers 400 for a body that is not JSON', async () => {
        assert.deepEqual(await post('{"to":'), { status: 400, body: { success: false, error: 'Malformed JSON' } });
    });

    test('lists refused mails apart from accepted ones, with ids that count up', async () => {
        const refused = await get<RefusedMail[]>('/__mails/refused');
        assert.deepEqual(refused.map((mail) => mail.id), refused.map((_, index) => index + 1));
        assert.ok(refused.length >= 4);
        const accepted = await get<{ template: string }[]>('/__mails');
        assert.ok(accepted.every((mail) => mail.template !== 'no_such_template.html'));
    });

    test('clearing the mails keeps the refused ones', async () => {
        const refusedBefore = (await get<RefusedMail[]>('/__mails/refused')).length;
        assert.equal((await fetch(`${base}/__mails`, { method: 'DELETE' })).status, 200);
        assert.deepEqual(await get('/__mails'), []);
        assert.equal((await get<RefusedMail[]>('/__mails/refused')).length, refusedBefore);
    });
});
