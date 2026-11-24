// Data that the network tests create for themselves through the APIs, as admin: Agorae,
// boards and the events the Antenna Criteria count. Boards are deleted again; Agorae, events,
// Summer Universities and what network stores per Agora stay in the test databases (none of
// them can be deleted once published), with names and ids no other test uses.
import { expect } from '@playwright/test';

import type { Api, Envelope, StatutoryEvent } from './api.ts';
import type { Cleanup, TestAntenna } from './core-data.ts';
import { uploadPicture } from './core-data.ts';

const DAY = 24 * 60 * 60 * 1000;
const at = (days: number): Date => new Date(Date.now() + days * DAY);
export const day = (days: number): string => at(days).toISOString().slice(0, 10);

// A published Agora, which the Antenna Criteria page lists.
export async function createPublishedAgora(api: Api, overrides: Record<string, unknown> = {}): Promise<StatutoryEvent> {
    const agora = await api.createStatutoryEvent({ type: 'agora', ...overrides });
    const published = await api.call('admin', 'PUT', `/api/statutory/events/${agora.id}/status`, { status: 'published' });
    expect(published.status, `publish the Agora: ${JSON.stringify(published.body)}`).toBe(200);
    return agora;
}

export interface RealBoard {
    id: number;
    body_id: number;
    elected_date: string;
}

// A board of the antenna with its member in every position, and its cleanup.
export async function createBoard(api: Api, { body, member }: TestAntenna, overrides: Record<string, unknown> = {}): Promise<[RealBoard, Cleanup]> {
    const path = `/api/network/bodies/${body.id}/boards`;
    const created = await api.call<Envelope<RealBoard>>('admin', 'POST', path, {
        elected_date: day(-30),
        start_date: day(-1),
        president: member.id,
        secretary: member.id,
        treasurer: member.id,
        ...overrides
    });
    expect(created.status, `create a board: ${JSON.stringify(created.body)}`).toBe(200);
    const boards = await api.call<Envelope<RealBoard[]>>('admin', 'GET', path);
    expect(boards.status, `list the boards: ${JSON.stringify(boards.body)}`).toBe(200);
    const [board] = boards.body.data;
    return [board, async () => {
        const deleted = await api.call('admin', 'DELETE', `${path}/${board.id}`);
        expect(deleted.status, `delete the board: ${JSON.stringify(deleted.body)}`).toBe(200);
    }];
}

// A Summer University organised by the antenna, approved twice and fully published by admin.
export async function createPublishedSummerUniversity(api: Api, { body }: TestAntenna): Promise<number> {
    const [admin, ...team] = await Promise.all((['admin', 'member', 'board', 'suct'] as const).map((username) => api.me(username)));
    const created = await api.call<Envelope<{ id: number }>>('admin', 'POST', '/api/summeruniversity/', {
        name: `E2E Summer University ${Date.now()}`,
        url: `e2e-su-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
        description: 'Created by the e2e tests',
        email: 'su@example.com',
        starts: at(60),
        ends: at(70),
        type: 'regular',
        theme_category: 'leisure',
        theme: 'Discovering the city',
        theme_implementation: 'Walks through the city',
        learning_objectives: ['Get to know the city', 'Make friends'],
        fee: 150,
        organizing_bodies: [{ body_id: body.id }],
        locations: [{ name: 'Brussels', position: { lat: 50.85, lng: 4.35 }, start: true, end: true }],
        // Four organisers with these roles are required.
        organizers: [
            { user_id: admin.id, body_id: body.id, role: 'main_coordinator' },
            ...['content_manager', 'treasurer', 'incoming_responsible'].map((role, index) => ({ user_id: team[index].id, role }))
        ],
        max_participants: 30,
        programme_suct: 'https://www.example.org/programme',
        accommodation_type: 'Hostel',
        agreed_to_su_terms: true,
        questions: [{ description: 'Why do you want to come?' }]
    });
    expect(created.status, `create a Summer University: ${JSON.stringify(created.body)}`).toBe(201);
    const { id } = created.body.data;
    await uploadPicture(api, 'admin', `/api/summeruniversity/single/${id}/upload`);
    for (const status of ['first approval', 'second submission', 'second approval']) {
        const res = await api.call('admin', 'PUT', `/api/summeruniversity/single/${id}/status`, { status });
        expect(res.status, `Summer University to ${status}: ${JSON.stringify(res.body)}`).toBe(200);
    }
    const published = await api.call('admin', 'PUT', `/api/summeruniversity/single/${id}/published`, { published: 'full' });
    expect(published.status, `publish the Summer University: ${JSON.stringify(published.body)}`).toBe(200);
    return id;
}
