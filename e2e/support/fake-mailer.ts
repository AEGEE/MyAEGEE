// Stand-in for the mailer service. It takes the same POST / the services send, checks it
// against the mail contract (mailer/contract/mail-templates.json, through the checker the
// services' jest suites use) and answers the way the real mailer does:
//   200 { success: true }                     the mail matches the contract
//   404 { success: false, error: "..." }      the contract lists no such template
//   422 { success: false, error: "..." }      a field or parameter is missing or has the wrong type
// It sends nothing. What it received is there for the tests:
//   GET    /__mails          -> the mails it accepted
//   GET    /__mails/refused  -> the mails it refused, with the answer and every problem
//   DELETE /__mails          -> clear the accepted mails (the refused ones stay, so that no
//                               test can hide a mail that broke the contract)
// The `mailContract` fixture in support/api.ts fails a test during which a mail was refused.
import http from 'node:http';

// The mail contract lives with the mailer; its checker has no dependencies, so it is loaded
// from its place in the repository, as the services' jest suites do.
// eslint-disable-next-line import/no-relative-packages -- the contract is a file of the mailer, not a dependency
import { checkMail } from '../../mailer/contract/check-mail.cjs';
import { PORTS } from './constants.ts';

export interface RefusedMail {
    // Counts up from 1 over the life of the fake mailer, also across DELETE /__mails.
    id: number;
    status: 404 | 422;
    error: string;
    template: unknown;
    mail: unknown;
    received_at: string;
}

export interface Answer {
    status: number;
    body: { success: boolean; error?: string };
}

// What the real mailer checks before it looks the template up (Omsmailer.Page.check_request):
// the four fields are there, the template is a non-empty string, the parameters are an object
// or a list. A request that fails one of these is refused with 422, not 404.
const REQUEST_FIELD = /^(\(root\): |(to|subject|template|parameters): missing$|template: |parameters: expected )/;

// The answer of the real mailer to `mail`, and the problem behind a refusal.
export const answerFor = (mail: unknown): Answer => {
    const result = checkMail(mail);
    if (result.ok) {
        return { status: 200, body: { success: true } };
    }

    const requestErrors = result.errors.filter((error) => REQUEST_FIELD.test(error));
    if (result.unknownTemplate && requestErrors.length === 0) {
        // The real mailer's text goes on with the list of templates it has.
        return { status: 404, body: { success: false, error: `Template ${result.template}.html not found (the mail contract does not list it)` } };
    }

    const errors = requestErrors.length ? requestErrors : result.errors;
    return { status: 422, body: { success: false, error: `Mail breaks the contract: ${errors.join('; ')}` } };
};

const send = (res: http.ServerResponse, status: number, body: unknown): void => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
};

export const createFakeMailer = ({ log = (line: string) => { process.stderr.write(`${line}\n`); } } = {}): http.Server => {
    let mails: Record<string, unknown>[] = [];
    const refused: RefusedMail[] = [];

    return http.createServer((req, res) => {
        let raw = '';
        req.on('data', (chunk) => { raw += chunk; });
        req.on('end', () => {
            if (req.method === 'POST' && req.url === '/') {
                let mail: unknown;
                try {
                    mail = JSON.parse(raw || '{}');
                } catch {
                    return send(res, 400, { success: false, error: 'Malformed JSON' });
                }

                const receivedAt = new Date().toISOString();
                const answer = answerFor(mail);
                if (answer.status === 200) {
                    mails.push({ ...(mail as Record<string, unknown>), received_at: receivedAt });
                } else {
                    const template = (mail as { template?: unknown } | null)?.template;
                    refused.push({ id: refused.length + 1, status: answer.status as 404 | 422, error: answer.body.error!, template, mail, received_at: receivedAt });
                    log(`fake mailer: refused a ${String(template)} mail with ${answer.status}: ${answer.body.error}`);
                }
                return send(res, answer.status, answer.body);
            }

            if (req.url === '/__mails' && req.method === 'GET') {
                return send(res, 200, { success: true, data: mails });
            }

            if (req.url === '/__mails/refused' && req.method === 'GET') {
                return send(res, 200, { success: true, data: refused });
            }

            if (req.url === '/__mails' && req.method === 'DELETE') {
                mails = [];
                return send(res, 200, { success: true });
            }

            if (req.url === '/healthcheck') {
                return send(res, 200, { success: true });
            }

            return send(res, 404, { success: false, message: 'Not found' });
        });
    });
};

// Started by Playwright as a webServer (playwright.config.ts); support/fake-mailer.test.ts imports it.
if (import.meta.main) {
    createFakeMailer().listen(PORTS.mailer, '127.0.0.1');
}
