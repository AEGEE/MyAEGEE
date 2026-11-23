// Test data for the flows through the applications to statutory events, made through the core
// API as admin like the helpers of core-data.ts. Each helper returns a cleanup function.
import type { Api } from './api.ts';
import type { Username } from './constants.ts';
import { asAdmin, grantPermission, type Cleanup, type TestMember } from './core-data.ts';

// Makes `username` a member of the body and gives them `local:approve_members:<type>` there,
// through a circle bound to the body: what the board of an antenna has to give its applicants
// a place at a statutory event. The membership goes with the body; the cleanup removes the
// circle.
export async function makeBoardMember(api: Api, username: Username, bodyId: number, eventType = 'agora'): Promise<Cleanup> {
    const user = await api.me(username);
    if (!user.bodies.some((body) => body.id === bodyId)) {
        await asAdmin(api, 'POST', `/bodies/${bodyId}/members`, { user_id: user.id });
    }

    const [, cleanup] = await grantPermission(api, username, `local:approve_members:${eventType}`, { bodyId });
    return cleanup;
}

// Statutory takes the gender and the date of birth of an application from the profile, and
// refuses an application without them; a member who just signed up has neither.
export async function completeProfile(api: Api, member: TestMember): Promise<void> {
    await asAdmin(api, 'PUT', `/members/${member.id}`, { date_of_birth: '1999-05-01', gender: 'neutral' });
}
