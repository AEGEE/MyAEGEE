// Test data for the flows through the plenaries of an Agora, made through the APIs as admin like
// the helpers of core-data.ts and statutory-applications-data.ts. Each helper that leaves
// something behind returns a cleanup function.
import type { Api, StatutoryApplication, StatutoryEvent } from './api.ts';
import { expectStatus } from './api.ts';
import type { Username } from './constants.ts';
import { asAdmin, grantPermission, type Cleanup } from './core-data.ts';

// The permission statutory asks for to mark attendances. Core's seed doesn't have it (it has
// `global:manage_plenaries:agora`), so a test that needs it creates it.
export const MARK_ATTENDANCE = 'global:mark_attendance:agora';

// Makes sure core has the permission `combined`, and returns the cleanup that deletes it again
// if it was created here. A superadmin holds every permission core has, so this alone gives
// it to admin.
export async function ensurePermission(api: Api, combined: string, description: string): Promise<Cleanup> {
    const found = await asAdmin<{ id: number; combined: string }[]>(api, 'GET', `/permissions?query=${encodeURIComponent(combined)}`);
    if (found.some((item) => item.combined === combined)) return async () => {};

    const [scope, action, object] = combined.split(':');
    const created = await asAdmin<{ id: number }>(api, 'POST', '/permissions', { scope, action, object, description });
    return async () => { await asAdmin(api, 'DELETE', `/permissions/${created.id}`); };
}

// Gives `username` what the chair of an Agora needs for its plenaries: creating and editing
// them (`global:manage_plenaries:agora`, which also lets them see the plenaries) and marking who
// attends (`global:mark_attendance:agora`), each through a circle of its own.
export async function makeChair(api: Api, username: Username): Promise<Cleanup> {
    const steps: Cleanup[] = [];
    try {
        steps.push(await ensurePermission(api, MARK_ATTENDANCE, 'Mark the attendance of delegates and envoys at the plenaries of Agora'));
        steps.push((await grantPermission(api, username, 'global:manage_plenaries:agora'))[1]);
        steps.push((await grantPermission(api, username, MARK_ATTENDANCE))[1]);
    } catch (err) {
        for (const step of steps.reverse()) await step();
        throw err;
    }
    return async () => {
        for (const step of steps.reverse()) await step();
    };
}

// `username` applies to the event and gets delegate 1 of their body, and the application is
// accepted: someone whose attendance can be marked. Applications go with their event.
export async function acceptedDelegate(api: Api, event: StatutoryEvent, username: Username): Promise<StatutoryApplication> {
    const applied = await api.applyToStatutory(username, event);
    expectStatus(await api.call('admin', 'PUT', `/api/statutory/events/${event.id}/applications/${applied.id}/board`, {
        board_comment: 'Our delegate', participant_type: 'delegate', participant_order: 1
    }), 200);
    expectStatus(await api.call('admin', 'PUT', `/api/statutory/events/${event.id}/applications/${applied.id}/status`, { status: 'accepted' }), 200);
    return applied;
}
