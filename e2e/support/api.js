/* global window */
// Helpers for talking to the e2e stack through the gateway, the same way the frontend does.
const { test: base, expect } = require('@playwright/test');

const { PASSWORD, SECOND_ANTENNA, url } = require('./constants');

const DAY = 24 * 60 * 60 * 1000;

class Api {
    constructor(request) {
        this.request = request;
        this.tokens = {};
        this.users = {};
    }

    async login(username) {
        if (!this.tokens[username]) {
            const res = await this.request.post('/api/core/login', { data: { username, password: PASSWORD } });
            expect(res.ok(), `login as ${username}`).toBeTruthy();
            const body = await res.json();
            this.tokens[username] = { access: body.access_token, refresh: body.refresh_token };
        }

        return this.tokens[username].access;
    }

    // Sends a request as `username` (or anonymously when username is null) and
    // returns { status, body } so tests can assert on both.
    async call(username, method, path, data) {
        const headers = { 'X-Requested-With': 'XMLHttpRequest' };
        if (username) {
            headers['X-Auth-Token'] = await this.login(username);
        }

        const res = await this.request.fetch(path, { method, headers, data });
        let body = null;
        try {
            body = await res.json();
        } catch (err) {
            body = await res.text();
        }

        return { status: res.status(), body };
    }

    async me(username) {
        if (!this.users[username]) {
            const { status, body } = await this.call(username, 'GET', '/api/core/members/me');
            expect(status, `fetch /members/me for ${username}`).toBe(200);
            this.users[username] = body.data;
        }

        return this.users[username];
    }

    async bodyByName(name) {
        const { body } = await this.call(null, 'GET', `/api/core/bodies?query=${encodeURIComponent(name)}`);
        const found = body.data.find((b) => b.name === name);
        expect(found, `body ${name}`).toBeTruthy();
        return found;
    }

    secondAntenna() {
        return this.bodyByName(SECOND_ANTENNA.name);
    }

    // Valid event creation payload with `username` as the only organizer unless
    // `organizers` is given. Applications are open from yesterday until in 10 days.
    // Users without bodies (like admin) organize on behalf of the seeded antenna.
    async eventPayload(username, { organizingBody, organizers, ...overrides } = {}) {
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

    async createEvent(username, options = {}) {
        const payload = await this.eventPayload(username, options);
        const { status, body } = await this.call(username, 'POST', '/api/events/', payload);
        expect(status, `create event as ${username}: ${JSON.stringify(body)}`).toBe(201);
        return body.data;
    }

    setStatus(username, eventId, status) {
        return this.call(username, 'PUT', `/api/events/single/${eventId}/status`, { status });
    }

    // Brings an event to `published` using the admin account.
    async publishAsAdmin(eventId) {
        for (const status of ['submitted', 'published']) {
            const res = await this.setStatus('admin', eventId, status);
            expect(res.status, `admin sets status ${status}: ${JSON.stringify(res.body)}`).toBe(200);
        }
    }

    async apply(username, eventId) {
        const user = await this.me(username);
        const { status, body } = await this.call(username, 'POST', `/api/events/single/${eventId}/applications`, {
            body_id: user.bodies[0].id,
            answers: [],
            agreed_to_privacy_policy: true
        });
        expect(status, `apply as ${username}: ${JSON.stringify(body)}`).toBe(200);
        return body.data;
    }

    async mails() {
        const res = await this.request.get(`${url('mailer')}/__mails`);
        return (await res.json()).data;
    }

    async clearMails() {
        await this.request.delete(`${url('mailer')}/__mails`);
    }
}

// Logs the browser in as `username` by storing the tokens the way the frontend does.
async function loginInBrowser(page, api, username) {
    await api.login(username);
    const { access, refresh } = api.tokens[username];
    await page.addInitScript(([accessToken, refreshToken]) => {
        window.localStorage.setItem('access-token', accessToken);
        window.localStorage.setItem('refresh-token', refreshToken);
    }, [access, refresh]);
}

const test = base.extend({
    api: async ({ request }, use) => {
        await use(new Api(request));
    }
});

const recipients = (mail) => [].concat(mail.to || [], mail.cc || []);

// Marks a test as documenting a known bug: it is expected to fail until the bug is
// fixed. Set E2E_SHOW_KNOWN_BUGS=1 to run these as normal tests and see how they fail.
const knownBug = (reason) => test.fail(!process.env.E2E_SHOW_KNOWN_BUGS, reason);

// Asserts the HTTP status and shows the response body when it doesn't match.
const expectStatus = (res, status) => expect(res.status, JSON.stringify(res.body)).toBe(status);

module.exports = {
    test,
    expect,
    expectStatus,
    knownBug,
    loginInBrowser,
    recipients
};
