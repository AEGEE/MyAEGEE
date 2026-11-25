// Checks the builders the mocked-API suite uses for the dashboard and the events calendar
// (ui/support/factories/dashboard.ts) against what events, statutory and summeruniversity
// really answer. See tests/core-contract.spec.ts for how the comparison works.
import type { Api, Envelope } from '../support/api.ts';
import { test, expect, expectStatus } from '../support/api.ts';
import { expectShape } from '../support/contract.ts';
import type { TestAntenna } from '../support/core-data.ts';
import { asAdmin, uploadPicture } from '../support/core-data.ts';
import {
    appliedEvent, appliedStatutoryEvent, appliedSummerUniversity, latestStatutoryEvent, dashboardStatutoryEvent, dashboardStatutoryPermissions, dashboardSummerUniversity
} from '../ui/support/factories/dashboard.ts';

type Row = Record<string, unknown> & { id: number };

const DAY = 24 * 60 * 60 * 1000;
const at = (days: number): Date => new Date(Date.now() + days * DAY);

// A Summer University that the member of `antenna` applied to: created, approved twice and
// published by admin, with its applications open.
const appliedSu = async (api: Api, { body, member }: TestAntenna): Promise<number> => {
    const [admin, ...team] = await Promise.all((['admin', 'member', 'board', 'suct'] as const).map((username) => api.me(username)));
    const created = await api.call<Envelope<Row>>('admin', 'POST', '/api/summeruniversity/', {
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
        optional_fee: 20,
        optional_programme: 'A trip to the sea',
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
    expectStatus(created, 201);
    const id = created.body.data.id;
    await uploadPicture(api, 'admin', `/api/summeruniversity/single/${id}/upload`);

    for (const status of ['first approval', 'second submission', 'second approval']) {
        expectStatus(await api.call('admin', 'PUT', `/api/summeruniversity/single/${id}/status`, { status }), 200);
    }
    expectStatus(await api.call('admin', 'PUT', `/api/summeruniversity/single/${id}/published`, { published: 'full' }), 200);
    expectStatus(await api.call('admin', 'PUT', `/api/summeruniversity/single/${id}/application_period`, { application_starts: at(-1), application_ends: at(30) }), 200);

    expectStatus(await api.call(member.username, 'POST', `/api/summeruniversity/single/${id}/applications`, {
        body_id: body.id,
        nationality: 'Belgian',
        travelling_from: 'Brussels',
        meals: 'vegetarian',
        aegee_experience: 'Local events',
        ideal_su: 'Culture and friends',
        motivation: 'To meet the network',
        answers: ['To see the city'],
        agreed_to_privacy_policy: true,
        agreed_to_su_terms: true
    }), 200);
    return id;
};

test.describe('dashboard factories match the real API', () => {
    test('the events a member applied to, of all three modules', async ({ api, otherAntenna }) => {
        const { member } = otherAntenna;
        // What statutory asks of an applicant, and a new member hasn't filled in yet.
        await asAdmin(api, 'PUT', `/members/${member.id}`, { date_of_birth: '1999-05-01', gender: 'neutral' });

        // events
        const created = await api.createEvent('admin', {
            locations: [{ name: 'Brussels', position: { lat: 50.85, lng: 4.35 } }],
            optional_programme: 'A city tour on the day after',
            link_info_travel_country: 'https://www.example.org/travel'
        });
        await uploadPicture(api, 'admin', `/api/events/single/${created.id}/upload`);
        await api.publishAsAdmin(created.id);
        await api.apply(member.username, created.id);

        const events = await api.call<Envelope<Row[]>>(member.username, 'GET', '/api/events/mine/participating');
        expectStatus(events, 200);
        expectShape('appliedEvent', appliedEvent({
            image: 'picture.png',
            locations: [{ name: 'x', position: { lat: 1, lng: 1 } }],
            optional_programme: 'x',
            link_info_travel_country: 'x'
        }), events.body.data.find((item) => item.id === created.id));

        // statutory
        const agora = await api.createStatutoryEvent();
        expectStatus(await api.call('admin', 'PUT', `/api/statutory/events/${agora.id}/status`, { status: 'published' }), 200);
        await api.applyToStatutory(member.username, agora);

        const statutory = await api.call<Envelope<Row[]>>(member.username, 'GET', '/api/statutory/mine');
        expectStatus(statutory, 200);
        expectShape('appliedStatutoryEvent', appliedStatutoryEvent(), statutory.body.data.find((item) => item.id === agora.id));

        // summeruniversity
        const suId = await appliedSu(api, otherAntenna);
        try {
            const su = await api.call<Envelope<Row[]>>(member.username, 'GET', '/api/summeruniversity/mine/participating');
            expectStatus(su, 200);
            const filled = { image: 'picture.png', optional_fee: 20, optional_programme: 'x' };
            expectShape('appliedSummerUniversity', appliedSummerUniversity(filled), su.body.data.find((item) => item.id === suId));

            // The calendar's list.
            const list = await api.call<Envelope<Row[]>>(null, 'GET', '/api/summeruniversity/');
            expectStatus(list, 200);
            expectShape('dashboardSummerUniversity', dashboardSummerUniversity({ ...filled, published: 'full' }), list.body.data.find((item) => item.id === suId));
        } finally {
            expectStatus(await api.call('admin', 'DELETE', `/api/summeruniversity/single/${suId}`), 200);
        }
    });

    test('the statutory events of the calendar and the latest one', async ({ api }) => {
        const agora = await api.createStatutoryEvent();
        expectStatus(await api.call('admin', 'PUT', `/api/statutory/events/${agora.id}/status`, { status: 'published' }), 200);

        const list = await api.call<Envelope<Row[]>>(null, 'GET', '/api/statutory/');
        expectStatus(list, 200);
        expectShape('dashboardStatutoryEvent', dashboardStatutoryEvent(), list.body.data.find((item) => item.id === agora.id));

        const latest = await api.call<Envelope<Row & { permissions: unknown }>>('member', 'GET', '/api/statutory/events/latest');
        expectStatus(latest, 200);
        expect(latest.body.data.status).toBe('published');
        expectShape('latestStatutoryEvent', latestStatutoryEvent(), latest.body.data);
        expectShape('dashboardStatutoryPermissions', dashboardStatutoryPermissions(), latest.body.data.permissions);
    });
});
