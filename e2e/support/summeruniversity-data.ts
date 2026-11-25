// Summer Universities, seasons and applications that real-stack tests create for themselves,
// through the summeruniversity API. Seasons and SUs can't be deleted (an SU is only marked as
// deleted), so every helper makes new ones with unique names and years.
import { expect } from '@playwright/test';

import type { Api, Envelope } from './api.ts';
import type { Username } from './constants.ts';

const DAY = 24 * 60 * 60 * 1000;
const at = (days: number): string => new Date(Date.now() + days * DAY).toISOString();

export interface SuSeason {
    year: number;
    name: string;
    active: boolean;
}

export interface SuEvent {
    id: number;
    name: string;
    url: string;
    season: number;
    type: string;
    status: string;
    published: string;
    questions: { description: string }[];
}

export interface SuApplication {
    id: number;
    user_id: number;
    event_id: number;
    body_id: number;
}

// Calls summeruniversity as `username` and returns `data`, failing the test with the answer if
// the status isn't `status`. `path` is the service's own path (`/seasons`).
export async function asSu<T>(api: Api, username: Username, method: string, path: string, data?: unknown, status = 200): Promise<T> {
    const res = await api.call<Envelope<T>>(username, method, `/api/summeruniversity${path}`, data);
    expect(res.status, `${username} ${method} /api/summeruniversity${path}: ${JSON.stringify(res.body)}`).toBe(status);
    return res.body.data;
}

// A year that no season has yet, also on databases that are not reset between runs: seasons
// are unique by year and can't be deleted, so a random year would meet one of an earlier run
// sooner or later. Four digits, as the statistics only take those. The real-stack suite runs in
// one worker, so no other test takes the year in between.
export const freshYear = async (api: Api): Promise<number> => {
    const taken = new Set((await asSu<SuSeason[]>(api, 'suct', 'GET', '/seasons')).map((season) => season.year));
    expect(taken.size, 'every four-digit year from 3000 has a season: reset the databases').toBeLessThan(7000);
    let year: number;
    do {
        year = 3000 + Math.floor(Math.random() * 7000);
    } while (taken.has(year));
    return year;
};

// A new season, created by SUCT. It is not active: making it active would change the season
// every other test's SUs and applications belong to.
export const createSeason = async (api: Api, overrides: Record<string, unknown> = {}): Promise<SuSeason> => {
    const year = await freshYear(api);
    return asSu<SuSeason>(api, 'suct', 'POST', '/seasons', {
        year,
        name: `E2E season ${year}`,
        event_submission_deadline: at(-30),
        application_period_starts: at(-1),
        application_period_ends: at(30),
        ...overrides
    }, 201);
};

export const activateSeason = (api: Api, year: number): Promise<SuSeason> => asSu<SuSeason>(api, 'suct', 'PUT', `/seasons/${year}/active`);

export interface SuEventOptions {
    // Created by this user, who must be one of the organisers and may create SUs: SUCT by default.
    creator?: Username;
    // Organisers besides the creator; an SU needs at least four.
    organizers?: Username[];
    [field: string]: unknown;
}

// A new SU in `first submission`, the status every new SU starts in. Its organisers are the
// creator and three seeded users. Only managers of the type (SUCT) may give it a season other
// than the active one.
export async function createSuEvent(api: Api, { creator = 'suct', organizers = ['board', 'admin', 'netcom'], ...overrides }: SuEventOptions = {}): Promise<SuEvent> {
    const roles = ['main_coordinator', 'content_manager', 'treasurer', 'incoming_responsible', 'general_organizer'];
    const users = await Promise.all([creator, ...organizers].map((username) => api.me(username)));
    const member = await api.me('member');
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    return asSu<SuEvent>(api, creator, 'POST', '/', {
        name: `E2E Summer University ${suffix}`,
        url: `e2e-su-${suffix}`,
        description: 'Created by the e2e tests',
        email: `e2e-su-${suffix}@example.org`,
        starts: at(60),
        ends: at(70),
        type: 'regular',
        theme_category: 'leisure',
        theme: 'Mountains and languages',
        theme_implementation: 'A walk and a language lesson every day',
        learning_objectives: [{ name: '', description: 'Speak a new language' }],
        fee: 150,
        optional_fee: 20,
        organizing_bodies: [{ body_id: member.bodies[0].id }],
        locations: [{ name: 'Brussels', position: { lat: 50.85, lng: 4.35 }, description: 'The start', start: true, end: false }],
        organizers: users.map((user, index) => ({ user_id: user.id, role: roles[index % roles.length] })),
        max_participants: 20,
        programme_suct: 'https://programme.example.org/e2e',
        accommodation_type: 'Hostel',
        agreed_to_su_terms: true,
        questions: [{ name: '', description: 'Why this SU?', required: true }],
        ...overrides
    }, 201);
}

export const setSuStatus = (api: Api, eventId: number, status: string, username: Username = 'suct'): Promise<unknown> => asSu(api, username, 'PUT', `/single/${eventId}/status`, { status });

export const setSuPublished = (api: Api, eventId: number, published: 'none' | 'minimal' | 'full'): Promise<unknown> => asSu(api, 'suct', 'PUT', `/single/${eventId}/published`, { published });

// Opens the applications of a fully published SU: from yesterday until in 10 days by default.
export const setSuApplicationPeriod = (api: Api, eventId: number, { starts = at(-1), ends = at(10) }: { starts?: string; ends?: string } = {}): Promise<SuEvent> => asSu<SuEvent>(api, 'suct', 'PUT', `/single/${eventId}/application_period`, { application_starts: starts, application_ends: ends });

// Takes a new SU through both approvals as SUCT, publishes it in full and opens its
// applications, so members can apply.
export async function openSuEvent(api: Api, eventId: number): Promise<void> {
    for (const status of ['first approval', 'second submission', 'second approval']) {
        await setSuStatus(api, eventId, status);
    }
    await setSuPublished(api, eventId, 'minimal');
    await setSuPublished(api, eventId, 'full');
    await setSuApplicationPeriod(api, eventId);
}

// Applies to an SU as `username`, with their first body and an answer for every question.
// A member may have one application per season that is neither rejected nor cancelled, so
// give each test's SU a season of its own (createSeason) or cancel the application afterwards.
export async function applyToSu(api: Api, username: Username, event: SuEvent, overrides: Record<string, unknown> = {}): Promise<SuApplication> {
    const user = await api.me(username);
    return asSu<SuApplication>(api, username, 'POST', `/single/${event.id}/applications`, {
        body_id: user.bodies[0].id,
        nationality: 'Belgium',
        travelling_from: 'Ghent',
        visa_required: false,
        aegee_experience: 'Two local trainings',
        ideal_su: 'Mountains and new friends',
        motivation: 'I want to learn a language',
        answers: event.questions.map(() => 'Because of the mountains'),
        meals: 'Vegetarian',
        allergies: 'None',
        agreed_to_privacy_policy: true,
        agreed_to_su_terms: true,
        ...overrides
    });
}
