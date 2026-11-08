// Helpers for talking to the e2e stack through the gateway, the same way the frontend does.
import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test';

import { PASSWORD, SECOND_ANTENNA, url, type Username } from './constants.ts';

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

export interface Mail {
    subject: string;
    to?: string | string[];
    cc?: string | string[];
    [key: string]: unknown;
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

    async bodyByName(name: string): Promise<Body> {
        const { body } = await this.call<Envelope<Body[]>>(null, 'GET', `/api/core/bodies?query=${encodeURIComponent(name)}`);
        const found = body.data.find((b) => b.name === name);
        expect(found, `body ${name}`).toBeTruthy();
        return found as Body;
    }

    secondAntenna(): Promise<Body> {
        return this.bodyByName(SECOND_ANTENNA.name);
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
            budget: 'Budget for the e2e event',
            programme: 'Programme for the e2e event',
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

    async mails(): Promise<Mail[]> {
        const res = await this.request.get(`${url('mailer')}/__mails`);
        return ((await res.json()) as Envelope<Mail[]>).data;
    }

    async clearMails(): Promise<void> {
        await this.request.delete(`${url('mailer')}/__mails`);
    }
}

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

export const test = base.extend<{ api: Api; knownBugGuard: void }>({
    // The frontend loads fonts and map tiles from the internet. The tests don't need them,
    // and a slow or failing external request would delay the page's load event, so block them.
    context: async ({ context }, use) => {
        await context.route((requestUrl) => !LOCAL_HOSTS.includes(requestUrl.hostname), (route) => route.abort());
        await use(context);
    },
    api: async ({ request }, use) => {
        await use(new Api(request));
    },
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
    }, { auto: true }]
});

export const recipients = (mail: Mail): string[] => ([] as string[]).concat(mail.to || [], mail.cc || []);

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

// Asserts the HTTP status and shows the response body when it doesn't match.
export const expectStatus = (res: ApiResult, status: number): void => expect(res.status, JSON.stringify(res.body)).toBe(status);

export { expect };
