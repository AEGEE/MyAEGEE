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
        const body = await asAdmin<Body>(api, 'POST', '/bodies', {
            name: `AEGEE-E2E-${suffix}`,
            code: randomLetters(3),
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
