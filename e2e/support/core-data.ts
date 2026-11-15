// Test data that tests create for themselves through the core API, as admin, the same way
// it's set up in production. Going through the API (instead of writing to core's database)
// keeps the data consistent with core's validation and hooks.
// Every helper returns the data and a cleanup function; the fixtures in support/api.ts call it
// after the test, also when the test failed.
import { expect } from '@playwright/test';

import type { Api, Body, Envelope, Member } from './api.ts';
import { PASSWORD, type TestUsername } from './constants.ts';

export type Cleanup = () => Promise<void>;

export interface TestMember extends Member {
    username: TestUsername;
}

export interface TestAntenna {
    body: Body;
    member: TestMember;
}

interface Circle {
    id: number;
    name: string;
    body_id: number | null;
}

const randomLetters = (length: number): string => Array.from(
    { length },
    () => String.fromCharCode(97 + Math.floor(Math.random() * 26))
).join('');

// Calls core as admin and returns `data`, failing the test with the response if the call failed.
async function asAdmin<T>(api: Api, method: string, path: string, data?: unknown): Promise<T> {
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

// Creates an antenna like the seeded ones (its members get the general members circle's
// permissions) with one member who signed up through a campaign and is in no other body.
export async function createAntenna(api: Api): Promise<[TestAntenna, Cleanup]> {
    const suffix = randomLetters(8);
    const username: TestUsername = `e2e-${suffix}`;

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

    const signup = await api.call<Envelope<{ id: number }>>(null, 'POST', `/api/core/signup/${campaign.url}`, {
        username,
        email: `${username}@example.com`,
        password: PASSWORD,
        first_name: 'Organizer',
        last_name: `E2e ${suffix}`,
        privacy_consent: new Date()
    });
    expect(signup.status, `signup ${username}: ${JSON.stringify(signup.body)}`).toBe(200);
    await asAdmin(api, 'POST', `/members/${signup.body.data.id}/confirm`);

    const member = await api.me(username) as TestMember;

    const cleanup = async () => {
        await asAdmin(api, 'DELETE', `/members/${member.id}`);
        await asAdmin(api, 'DELETE', `/campaigns/${campaign.id}`);
        await asAdmin(api, 'PUT', `/bodies/${body.id}/status`, { status: 'deleted' });
    };

    return [{ body, member }, cleanup];
}
