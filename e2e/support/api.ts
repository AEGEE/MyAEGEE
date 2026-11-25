// Helpers for talking to the e2e stack through the gateway, the same way the frontend does.
import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test';

import { contractProblems, startContractCheck } from './contract.ts';
import { createAntenna, type TestAntenna } from './core-data.ts';
import { coverageFixtures, type CoverageFixtures, type CoverageWorkerFixtures } from './coverage.ts';
import type { RefusedMail } from './fake-mailer.ts';
import { PASSWORD, url, type Username } from './constants.ts';

const DAY = 24 * 60 * 60 * 1000;

// Response envelope of the MyAEGEE services.
export interface Envelope<T> {
    success: boolean;
    data: T;
    message?: string;
    meta?: Record<string, unknown>;
    errors?: Record<string, string[]>;
}

export interface ApiResult<T = unknown> {
    status: number;
    body: T;
}

export interface Body {
    id: number;
    name: string;
}

export interface Member {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    bodies: Body[];
}

export interface Organizer {
    user_id: number;
    first_name?: string;
    last_name?: string;
    comment?: string;
}

export interface Event {
    id: number;
    name: string;
    url: string;
    type: string;
    organizers: Organizer[];
}

export interface Application {
    id: number;
    user_id: number;
    first_name: string;
    event_type?: string;
}

export interface StatutoryEvent {
    id: number;
    name: string;
    url: string;
    type: string;
    questions: { description: string }[];
}

export interface StatutoryApplication {
    id: number;
    statutory_id: string;
    user_id: number;
    body_name: string;
}

// A mail as the services send it to the mailer (and the fake mailer records it): the mailer
// renders `template` with `parameters`.
export interface Mail {
    subject: string;
    template: string;
    parameters: Record<string, unknown>;
    to?: string | string[];
    cc?: string | string[];
    from?: string;
    reply_to?: string;
    received_at: string;
}

export interface EventOptions {
    organizingBody?: Body;
    organizers?: Organizer[];
    [field: string]: unknown;
}

interface Tokens {
    access: string;
    refresh: string;
}

export class Api {
    readonly request: APIRequestContext;

    readonly tokens: Partial<Record<Username, Tokens>> = {};

    private readonly users: Partial<Record<Username, Member>> = {};

    // Refused mails this test caused on purpose (expectRefusedMail), which the `mailContract`
    // fixture lets pass.
    readonly expectedRefusals = new Set<number>();

    constructor(request: APIRequestContext) {
        this.request = request;
    }

    async login(username: Username): Promise<Tokens> {
        const cached = this.tokens[username];
        if (cached) {
            return cached;
        }

        const res = await this.request.post('/api/core/login', { data: { username, password: PASSWORD } });
        expect(res.ok(), `login as ${username}`).toBeTruthy();
        const body = await res.json() as { access_token: string; refresh_token: string };
        const tokens = { access: body.access_token, refresh: body.refresh_token };
        this.tokens[username] = tokens;
        return tokens;
    }

    // Sends a request as `username` (or anonymously when username is null) and
    // returns { status, body } so tests can assert on both. `T` is the expected
    // body; it isn't checked at runtime.
    async call<T = unknown>(username: Username | null, method: string, path: string, data?: unknown): Promise<ApiResult<T>> {
        const headers: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' };
        if (username) {
            headers['X-Auth-Token'] = (await this.login(username)).access;
        }

        const res = await this.request.fetch(path, { method, headers, data });
        const text = await res.text();
        let body: unknown = text;
        try {
            body = JSON.parse(text);
        } catch {
            // Not JSON, keep the text.
        }

        return { status: res.status(), body: body as T };
    }

    async me(username: Username): Promise<Member> {
        const cached = this.users[username];
        if (cached) {
            return cached;
        }

        const { status, body } = await this.call<Envelope<Member>>(username, 'GET', '/api/core/members/me');
        expect(status, `fetch /members/me for ${username}`).toBe(200);
        this.users[username] = body.data;
        return body.data;
    }

    // Valid event creation payload with `username` as the only organizer unless
    // `organizers` is given. Applications are open from yesterday until in 10 days.
    // Users without bodies (like admin and not-member) organize on behalf of
    // member's antenna, a body they aren't in.
    async eventPayload(username: Username, { organizingBody, organizers, ...overrides }: EventOptions = {}): Promise<Record<string, unknown>> {
        const user = await this.me(username);
        const body = organizingBody || user.bodies[0] || (await this.me('member')).bodies[0];
        const now = Date.now();

        return {
            name: `E2E event ${now}`,
            url: `e2e-${now}-${Math.round(Math.random() * 1e6)}`,
            description: 'Created by the e2e tests',
            application_starts: new Date(now - DAY),
            application_ends: new Date(now + 10 * DAY),
            starts: new Date(now + 20 * DAY),
            ends: new Date(now + 22 * DAY),
            type: 'nwm',
            fee: 0,
            max_participants: 20,
            organizing_bodies: [{ body_id: body.id }],
            organizers: organizers || [{ user_id: user.id }],
            locations: [],
            questions: [],
            meals_per_day: 1,
            accommodation_type: 'Hostel',
            budget: 'https://docs.google.com/spreadsheets/d/e2e-budget',
            programme: 'https://docs.google.com/spreadsheets/d/e2e-programme',
            method: 'in person',
            has_applications: true,
            ...overrides
        };
    }

    async createEvent(username: Username, options: EventOptions = {}): Promise<Event> {
        const payload = await this.eventPayload(username, options);
        const { status, body } = await this.call<Envelope<Event>>(username, 'POST', '/api/events/', payload);
        expect(status, `create event as ${username}: ${JSON.stringify(body)}`).toBe(201);
        return body.data;
    }

    setStatus(username: Username, eventId: number, status: string): Promise<ApiResult> {
        return this.call(username, 'PUT', `/api/events/single/${eventId}/status`, { status });
    }

    // Brings an event to `published` using the admin account.
    async publishAsAdmin(eventId: number): Promise<void> {
        for (const status of ['submitted', 'published']) {
            const res = await this.setStatus('admin', eventId, status);
            expect(res.status, `admin sets status ${status}: ${JSON.stringify(res.body)}`).toBe(200);
        }
    }

    async apply(username: Username, eventId: number): Promise<Application> {
        const user = await this.me(username);
        const { status, body } = await this.call<Envelope<Application>>(username, 'POST', `/api/events/single/${eventId}/applications`, {
            body_id: user.bodies[0].id,
            answers: [],
            agreed_to_privacy_policy: true
        });
        expect(status, `apply as ${username}: ${JSON.stringify(body)}`).toBe(200);
        return body.data;
    }

    // Creates a statutory event as admin whose applications are open from yesterday until
    // in 10 days, with the later deadlines after that. Admin organizes it on behalf of
    // member's antenna, as admin has no bodies.
    async createStatutoryEvent(overrides: Record<string, unknown> = {}): Promise<StatutoryEvent> {
        const now = Date.now();
        const at = (days: number) => new Date(now + days * DAY);
        const payload = {
            name: `E2E statutory event ${now}`,
            url: `e2e-statutory-${now}-${Math.round(Math.random() * 1e6)}`,
            description: 'Created by the e2e tests',
            type: 'agora',
            body_id: (await this.me('member')).bodies[0].id,
            fee: 0,
            application_period_starts: at(-1),
            application_period_ends: at(10),
            board_approve_deadline: at(11),
            participants_list_publish_deadline: at(12),
            memberslist_submission_deadline: at(13),
            draft_proposal_deadline: at(5),
            final_proposal_deadline: at(8),
            candidature_deadline: at(8),
            booklet_publication_deadline: at(9),
            updated_booklet_publication_deadline: at(12),
            starts: at(20),
            ends: at(22),
            questions: [{ type: 'string', description: 'Why do you want to come?', required: true }],
            ...overrides
        };

        const { status, body } = await this.call<Envelope<StatutoryEvent>>('admin', 'POST', '/api/statutory/', payload);
        expect(status, `create statutory event: ${JSON.stringify(body)}`).toBe(200);

        // An event is created as a draft, which only its managers see and nobody can apply to.
        const published = await this.call('admin', 'PUT', `/api/statutory/events/${body.data.id}/status`, { status: 'published' });
        expect(published.status, `publish statutory event: ${JSON.stringify(published.body)}`).toBe(200);
        return body.data;
    }

    async applyToStatutory(username: Username, event: StatutoryEvent): Promise<StatutoryApplication> {
        const user = await this.me(username);
        const { status, body } = await this.call<Envelope<StatutoryApplication>>(username, 'POST', `/api/statutory/events/${event.id}/applications/`, {
            body_id: user.bodies[0].id,
            nationality: 'Belgian',
            meals: 'Vegetarian',
            number_of_events_visited: 0,
            answers: event.questions.map(() => 'Created by the e2e tests')
        });
        expect(status, `apply to statutory event as ${username}: ${JSON.stringify(body)}`).toBe(200);
        return body.data;
    }

    async mails(): Promise<Mail[]> {
        const res = await this.request.get(`${url('mailer')}/__mails`);
        return ((await res.json()) as Envelope<Mail[]>).data;
    }

    // The mails the fake mailer refused because they break the mail contract, over the whole run.
    async refusedMails(): Promise<RefusedMail[]> {
        const res = await this.request.get(`${url('mailer')}/__mails/refused`);
        return ((await res.json()) as Envelope<RefusedMail[]>).data;
    }

    // For a test that sends a mail that breaks the contract on purpose: returns the newest
    // refused mail of `template`, so the test can check the answer, and keeps the `mailContract`
    // fixture from failing the test for it.
    async expectRefusedMail(template: unknown): Promise<RefusedMail> {
        const mail = (await this.refusedMails()).findLast((refused) => refused.template === template && !this.expectedRefusals.has(refused.id));
        expect(mail, `a refused ${String(template)} mail`).toBeDefined();
        this.expectedRefusals.add(mail!.id);
        return mail!;
    }

    // Clears the accepted mails only: refused mails stay for the `mailContract` fixture.
    async clearMails(): Promise<void> {
        await this.request.delete(`${url('mailer')}/__mails`);
    }

    // Waits for a mail to `to` rendered from `template` (`confirm_email.html`) and returns the
    // newest one. Services may send after they answered, so this polls. Pass an address only
    // your test uses: other tests' mails stay in the list (never clear it in a test).
    async waitForMail({ to, template }: { to: string; template: string }): Promise<Mail> {
        let found: Mail | undefined;
        await expect.poll(async () => {
            found = (await this.mails()).findLast((mail) => mail.template === template && [mail.to ?? []].flat().includes(to));
            return found;
        }, { message: `a ${template} mail to ${to}`, timeout: 10 * 1000 }).toBeTruthy();
        return found as Mail;
    }
}

// What a link in the rendered mail points to, as a path in the frontend. The mailer's templates
// (mailer/lib/omsmailer_web/templates/page/) build these from the parameters; the fake mailer
// doesn't render, so the paths are repeated here for the templates that link somewhere specific.
const MAIL_LINKS: [RegExp, (parameters: Record<string, unknown>) => unknown][] = [
    [/^confirm_email\.html$/, (parameters) => `/confirm_signup?token=${parameters.token}`],
    [/^password_reset\.html$/, (parameters) => `/password_confirm?token=${parameters.token}`],
    [/^mail_change\.html$/, (parameters) => `/mail-change?token=${parameters.token}`],
    [/^member_joined\.html$/, (parameters) => `/bodies/${parameters.body_id}`],
    [/^workspace_(new|deleted)_member\.html$/, (parameters) => `/members/${parameters.user_id}`],
    [/^candidate_applied\.html$/, (parameters) => `/statutory/${(parameters.position as { event_id: number }).event_id}`],
    [/^events_(event_created|event_updated|status_changed|european_status_changed|submitted|spc_info)\.html$/, (parameters) => `/events/${(parameters.event as { url: string }).url}`],
    [/^summeruniversity_(event_created|event_updated|status_changed|submitted|organizer_applied|organizer_edited)\.html$/, (parameters) => `/summeruniversity/${(parameters.event as { url: string }).url}`],
    [/^statutory_board_(applied|edited)\.html$/, (parameters) => `/statutory/${(parameters.event as { url: string }).url}`]
];

export const mailLink = (mail: Mail): string => {
    const link = MAIL_LINKS.find(([template]) => template.test(mail.template));
    if (!link) {
        throw new Error(`mailLink: the ${mail.template} mail has no link to a page of its own.`);
    }

    const path = String(link[1](mail.parameters));
    if (path.includes('undefined')) {
        throw new Error(`mailLink: the ${mail.template} mail lacks the parameter its link needs: ${JSON.stringify(mail.parameters)}`);
    }

    return path;
};

// Logs the browser in as `username` by storing the tokens the way the frontend does.
export async function loginInBrowser(page: Page, api: Api, username: Username): Promise<void> {
    const { access, refresh } = await api.login(username);
    await page.addInitScript(([accessToken, refreshToken]) => {
        window.localStorage.setItem('access-token', accessToken);
        window.localStorage.setItem('refresh-token', refreshToken);
    }, [access, refresh]);
}

// eslint-disable-next-line no-control-regex
const stripAnsi = (text: string): string => text.replace(/\u001b\[[0-9;]*m/g, '');

// Expected errors of the known-bug tests in this worker, by test ID.
const knownBugErrors = new Map<string, RegExp>();

const LOCAL_HOSTS = ['127.0.0.1', 'localhost'];

export const test = base.extend<{ api: Api; otherAntenna: TestAntenna; knownBugGuard: void; contractCheck: void; mailContract: void } & CoverageFixtures, CoverageWorkerFixtures>({
    // Frontend coverage of the tests that open a browser, and the routes they visit
    // (only with E2E_COVERAGE=1, see support/coverage.ts).
    ...coverageFixtures('real'),
    // The frontend loads map tiles from the internet. The tests don't need them,
    // and a slow or failing external request would delay the page's load event, so block them.
    context: async ({ context }, use) => {
        await context.route((requestUrl) => !LOCAL_HOSTS.includes(requestUrl.hostname), (route) => route.abort());
        await use(context);
    },
    api: async ({ request }, use) => {
        await use(new Api(request));
    },
    // A new antenna with one member, who shares no body with the seeded users.
    // Created through the core API for the tests that ask for it, deleted afterwards.
    otherAntenna: async ({ api }, use) => {
        const [antenna, cleanup] = await createAntenna(api);
        await use(antenna);
        await cleanup();
    },
    // A test that compares factories with real answers (support/contract.ts) has to compare
    // every field of them, or say why it can't: a field that was null or an empty list on one
    // side in every comparison of the test fails it here.
    contractCheck: [async ({}, use, testInfo) => { // eslint-disable-line no-empty-pattern
        startContractCheck();
        await use();
        if (testInfo.status === testInfo.expectedStatus) {
            expect(contractProblems(), 'fields of the factories that this test left unchecked').toEqual([]);
        }
    }, { auto: true }],
    // Reports a known-bug test as a real failure when it fails with a different error
    // than the documented one. Every error of the test has to match, so a soft
    // assertion failing for another reason isn't hidden either.
    knownBugGuard: [async ({}, use, testInfo) => { // eslint-disable-line no-empty-pattern
        await use();

        const expectedError = knownBugErrors.get(testInfo.testId);
        knownBugErrors.delete(testInfo.testId);
        if (!expectedError || testInfo.status !== 'failed') {
            return;
        }

        const messages = testInfo.errors.map((error) => stripAnsi(error.message ?? ''));
        if (messages.length === 0 || !messages.every((message) => expectedError.test(message))) {
            testInfo.expectedStatus = 'passed';
            testInfo.annotations.push({
                type: 'known-bug-mismatch',
                description: `Expected the failure to match ${expectedError}, so this is reported as a real failure.`
            });
        }
    }, { auto: true }],
    // Fails a test during which the fake mailer refused a mail (support/fake-mailer.ts): a
    // service sent a mail that the real mailer would refuse too, so it would never arrive.
    // Many services only log a failed mail and answer the request as usual, so the test
    // would not notice otherwise. Always checked, also after a failure, because a refused
    // mail often explains it. Declared after knownBugGuard, so it runs before that guard
    // after the test and a known-bug test that also sends a broken mail is reported as failed.
    mailContract: [async ({ api }, use) => {
        const before = Math.max(0, ...(await api.refusedMails()).map((mail) => mail.id));
        await use();
        const refused = (await api.refusedMails())
            .filter((mail) => mail.id > before && !api.expectedRefusals.has(mail.id))
            .map((mail) => `${String(mail.template)}: ${mail.status} ${mail.error}`);
        expect(refused, 'mails the fake mailer refused because they break the mail contract in mailer/contract/mail-templates.json'
            + ' (fix the sender, or the contract and both renderers; a mail a service sends late can show up in the test after its own)').toEqual([]);
    }, { auto: true }]
});

const showKnownBugs = ['1', 'true'].includes(process.env.E2E_SHOW_KNOWN_BUGS ?? '');

// Marks a test as documenting a known bug: it is expected to fail until the bug is fixed.
// `expectedError` is a regex every failure of the test has to match; if the test fails for
// another reason (e.g. its setup broke), it is reported as a real failure.
// Set E2E_SHOW_KNOWN_BUGS=1 to run these as normal tests and see how they fail.
export const knownBug = (reason: string, expectedError: RegExp): void => {
    if (showKnownBugs) {
        return;
    }

    // Without the global/sticky flags, test() doesn't keep state between calls.
    const pattern = new RegExp(expectedError.source, expectedError.flags.replace(/[gy]/g, ''));
    test.fail(true, reason);
    test.info().annotations.push({ type: 'known-bug-error', description: String(pattern) });
    knownBugErrors.set(test.info().testId, pattern);
};

// Details for a test that only checks behaviour of one module and belongs in that module's tests
// (see "Scope" in the README). `npx playwright test --list --grep @move-to-module` lists them.
export const moveToModule = (module: string, note: string) => ({
    tag: '@move-to-module',
    annotation: { type: 'move-to-module', description: `${module}: ${note}` }
});

// Asserts the HTTP status and shows the response body when it doesn't match.
export const expectStatus = (res: ApiResult, status: number): void => expect(res.status, JSON.stringify(res.body)).toBe(status);

export { expect };
