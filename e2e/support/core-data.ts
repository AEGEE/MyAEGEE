// Test data that tests create for themselves through the core API, as admin, the same way
// it's set up in production. Going through the API (instead of writing to core's database)
// keeps the data consistent with core's validation and hooks.
// Every helper returns the data and a cleanup function; the fixtures in support/api.ts call it
// after the test, also when the test failed.
import { expect } from '@playwright/test';

import type { Api, Body, Envelope, Member } from './api.ts';
import { PASSWORD, type TestUsername, type Username } from './constants.ts';

export type Cleanup = () => Promise<void>;

export interface TestMember extends Member {
    username: TestUsername;
}

export interface TestAntenna {
    body: Body;
    member: TestMember;
}

export interface Circle {
    id: number;
    name: string;
    description: string;
    body_id: number | null;
    parent_circle_id: number | null;
}

export interface Campaign {
    id: number;
    name: string;
    url: string;
    active: boolean;
    autojoin_body_id: number | null;
}

const randomLetters = (length: number): string => Array.from(
    { length },
    () => String.fromCharCode(97 + Math.floor(Math.random() * 26))
).join('');

// Calls core as admin and returns `data`, failing the test with the response if the call failed.
// `path` is core's own path (`/bodies/1`), without `/api/core`.
export async function asAdmin<T>(api: Api, method: string, path: string, data?: unknown): Promise<T> {
    const res = await api.call<Envelope<T>>('admin', method, `/api/core${path}`, data);
    expect(res.status, `admin ${method} /api/core${path}: ${JSON.stringify(res.body)}`).toBe(200);
    return res.body.data;
}

async function findGlobalCircle(api: Api, name: string): Promise<Circle> {
    const circles = await asAdmin<Circle[]>(api, 'GET', `/circles?query=${encodeURIComponent(name)}`);
    const circle = circles.find((c) => c.name === name && c.body_id === null);
    expect(circle, `circle ${name}`).toBeTruthy();
    return circle as Circle;
}

// Core refuses a body code another body has, deleted bodies included, and three letters give
// only 17,576 codes, so a run that creates many antennas can draw a taken one. Draw again then.
async function createBodyWithFreeCode(api: Api, fields: Record<string, unknown>): Promise<Body> {
    for (let attempt = 1; ; attempt += 1) {
        const res = await api.call<Envelope<Body>>('admin', 'POST', '/api/core/bodies', { ...fields, code: randomLetters(3) });
        const codeTaken = res.status === 422 && JSON.stringify(res.body).includes('code must be unique');
        if (!codeTaken || attempt === 5) {
            expect(res.status, `admin POST /api/core/bodies: ${JSON.stringify(res.body)}`).toBe(200);
            return res.body.data;
        }
    }
}

// Runs the undo steps of a helper in reverse order. Helpers add a step right after creating
// something, so a helper that fails halfway still removes what it created before rethrowing.
function undoStack(): { add: (step: Cleanup) => void; run: Cleanup } {
    const steps: Cleanup[] = [];
    return {
        add: (step) => { steps.push(step); },
        run: async () => {
            while (steps.length > 0) {
                await steps.pop()!();
            }
        }
    };
}

// Creates an antenna like the seeded ones (its members get the general members circle's
// permissions) with one member who signed up through a campaign and is in no other body.
export async function createAntenna(api: Api): Promise<[TestAntenna, Cleanup]> {
    const suffix = randomLetters(8);
    const username: TestUsername = `e2e-${suffix}`;
    const undo = undoStack();

    try {
        const body = await createBodyWithFreeCode(api, {
            name: `AEGEE-E2E-${suffix}`,
            description: 'Antenna created by an e2e test',
            type: 'antenna',
            phone: '1-800-111-11-11',
            address: 'Somewhere in Europe',
            founded_at: '1970-01-01',
            email: `${username}-body@example.com`
        });
        // Deleting a body also removes its circles and memberships.
        undo.add(async () => { await asAdmin(api, 'PUT', `/bodies/${body.id}/status`, { status: 'deleted' }); });

        // New members join the body's shadow circle, which inherits the general members circle.
        const membersCircle = await asAdmin<Circle>(api, 'POST', `/bodies/${body.id}/circles`, {
            name: `Members ${body.name}`,
            description: `Members ${body.name}`
        });
        const generalMembersCircle = await findGlobalCircle(api, 'General members circle');
        await asAdmin(api, 'PUT', `/circles/${membersCircle.id}/parent`, { parent_circle_id: generalMembersCircle.id });
        await asAdmin(api, 'PUT', `/bodies/${body.id}`, { shadow_circle_id: membersCircle.id });

        const campaign = await asAdmin<{ id: number; url: string }>(api, 'POST', '/campaigns', {
            name: `E2E ${suffix}`,
            url: username,
            active: true,
            description_short: 'Campaign created by an e2e test',
            description_long: 'Campaign created by an e2e test',
            autojoin_body_id: body.id
        });
        undo.add(async () => { await asAdmin(api, 'DELETE', `/campaigns/${campaign.id}`); });

        const signup = await api.call<Envelope<{ id: number }>>(null, 'POST', `/api/core/signup/${campaign.url}`, {
            username,
            email: `${username}@example.com`,
            password: PASSWORD,
            first_name: 'Organizer',
            last_name: `Antenna ${suffix}`,
            privacy_consent: new Date()
        });
        expect(signup.status, `signup ${username}: ${JSON.stringify(signup.body)}`).toBe(200);
        undo.add(async () => { await asAdmin(api, 'DELETE', `/members/${signup.body.data.id}`); });
        await asAdmin(api, 'POST', `/members/${signup.body.data.id}/confirm`);

        const member = await api.me(username) as TestMember;
        return [{ body, member }, undo.run];
    } catch (err) {
        await undo.run();
        throw err;
    }
}

// A picture small enough to write here and real enough for the services, which look at the
// content of an upload and not only at its name: a PNG of one pixel.
export const ONE_PIXEL_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

// Uploads a picture the way the frontend does (multipart, field `head_image`) to a service's
// upload endpoint: `/api/core/members/<id>/upload`, `/api/events/single/<id>/upload`.
export async function uploadPicture(api: Api, username: Username, path: string): Promise<void> {
    const { access } = await api.login(username);
    const res = await api.request.post(path, {
        headers: { 'X-Requested-With': 'XMLHttpRequest', 'X-Auth-Token': access },
        multipart: { head_image: { name: 'picture.png', mimeType: 'image/png', buffer: ONE_PIXEL_PNG } }
    });
    expect(res.status(), `upload to ${path}: ${await res.text()}`).toBe(200);
}

// Gives the antenna of `createAntenna` and its member a value for every field that is empty
// after signing up, so a contract check has something to compare: the optional details of the
// body and of the member, a picture, a primary body, a Workspace address, a pending request to
// join `otherBodyId` and a ban on applying to events. Everything goes with the antenna and its
// member when their cleanup runs.
export async function fillAntenna(api: Api, { body, member }: TestAntenna, { otherBodyId }: { otherBodyId: number }): Promise<void> {
    await asAdmin(api, 'PUT', `/bodies/${body.id}`, {
        task_description: 'Organises the test events',
        abbreviation: `E2E-${body.id}`,
        fee_currency: 'EUR',
        country: 'Belgium',
        website: 'https://www.example.org'
    });
    await asAdmin(api, 'PUT', `/members/${member.id}`, {
        date_of_birth: '1999-05-01',
        gender: 'neutral',
        phone: '+32 2 123 45 67',
        address: 'Somewhere in Europe',
        about_me: 'Member of an antenna made for a test',
        gsuite_id: `${member.username}@aegee.eu`
    });
    await uploadPicture(api, 'admin', `/api/core/members/${member.id}/upload`);
    await asAdmin(api, 'PUT', `/members/${member.id}/primary-body`, { primary_body_id: body.id });
    await asAdmin(api, 'PUT', `/members/${member.id}/event-application-ban`, {
        ban_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        reason: 'Did not show up at an event'
    });

    const request = await api.call(member.username, 'POST', `/api/core/bodies/${otherBodyId}/join-requests`, { motivation: 'To compare a join request' });
    expect(request.status, `join request of ${member.username}: ${JSON.stringify(request.body)}`).toBe(200);
}

// Creates a circle without members or permissions: a free one, or one bound to a body when
// `bodyId` is given (only members of that body can join it).
export async function createCircle(api: Api, { bodyId }: { bodyId?: number } = {}): Promise<[Circle, Cleanup]> {
    const suffix = randomLetters(8);
    const circle = await asAdmin<Circle>(api, 'POST', bodyId === undefined ? '/circles' : `/bodies/${bodyId}/circles`, {
        name: `E2E circle ${suffix}`,
        description: 'Circle created by an e2e test'
    });
    // Deleting a circle also removes its memberships and permissions.
    return [circle, async () => { await asAdmin(api, 'DELETE', `/circles/${circle.id}`); }];
}

// Creates an active signup campaign at `/signup/<url>`. With `autojoinBody`, those who sign up
// through it become members of that body. The cleanup also deletes whoever signed up through
// it, so a signup test leaves no users behind.
export async function createCampaign(api: Api, { autojoinBody }: { autojoinBody?: number } = {}): Promise<[Campaign, Cleanup]> {
    const suffix = randomLetters(8);
    const campaign = await asAdmin<Campaign>(api, 'POST', '/campaigns', {
        name: `E2E campaign ${suffix}`,
        url: `e2e-${suffix}`,
        active: true,
        description_short: 'Campaign created by an e2e test',
        description_long: 'Campaign created by an e2e test',
        ...(autojoinBody === undefined ? {} : { autojoin_body_id: autojoinBody })
    });

    return [campaign, async () => {
        // Core would keep them, without their campaign.
        const members = await asAdmin<{ id: number }[]>(api, 'GET', `/campaigns/${campaign.id}/members`);
        for (const member of members) {
            await asAdmin(api, 'DELETE', `/members/${member.id}`);
        }
        await asAdmin(api, 'DELETE', `/campaigns/${campaign.id}`);
    }];
}

// Gives `username` one permission (`scope:action:object`, as in core/scripts/seed-permissions.js)
// the way it happens in production: through a new circle that has the permission and the user
// as a member. A `local:` permission only counts inside a body, so it needs `bodyId`: the circle
// is bound to that body, and the user has to be a member of it. The cleanup deletes the circle,
// and with it the membership and the permission link.
export async function grantPermission(api: Api, username: Username, combined: string, { bodyId }: { bodyId?: number } = {}): Promise<[Circle, Cleanup]> {
    if (combined.startsWith('local:') && bodyId === undefined) {
        throw new Error(`grantPermission: ${combined} is local, so it needs the bodyId it applies to.`);
    }

    const found = await asAdmin<{ id: number; combined: string }[]>(api, 'GET', `/permissions?query=${encodeURIComponent(combined)}`);
    const permission = found.find((item) => item.combined === combined);
    if (!permission) {
        throw new Error(`grantPermission: core has no permission ${combined}.`);
    }

    const user = await api.me(username);
    const [circle, cleanup] = await createCircle(api, { bodyId });
    try {
        await asAdmin(api, 'POST', `/circles/${circle.id}/permissions`, { permission_id: permission.id });
        await asAdmin(api, 'POST', `/circles/${circle.id}/members`, { user_id: user.id });
    } catch (err) {
        await cleanup();
        throw err;
    }

    return [circle, cleanup];
}
