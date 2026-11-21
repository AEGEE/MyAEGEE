// The mocked-API suite (ui/) answers the frontend with objects from ui/support/factories.ts.
// This checks those objects against what the real services answer: every field a factory
// builds has to exist in the real response with the same type, so the mocks can't drift away
// from the APIs unnoticed. (The real responses may have more fields.)
import type { Envelope } from '../support/api.ts';
import { test, expect } from '../support/api.ts';
import * as factories from '../ui/support/factories.ts';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const typeOf = (value: unknown): string => {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
};

// Paths in `expected` that `actual` doesn't have, or has with another type. null on either side
// matches anything (nullable fields), and arrays are compared by their first element.
const differences = (expected: unknown, actual: unknown, at = '$'): string[] => {
    if (expected === null || actual === null || expected === undefined) return [];
    if (typeOf(expected) !== typeOf(actual)) return [`${at}: factory has ${typeOf(expected)}, service has ${typeOf(actual)}`];
    if (Array.isArray(expected)) {
        return expected.length && (actual as Json[]).length ? differences(expected[0], (actual as Json[])[0], `${at}[0]`) : [];
    }
    if (typeof expected === 'object') {
        return Object.entries(expected as Record<string, unknown>).flatMap(([key, value]) => (key in (actual as object)
            ? differences(value, (actual as Record<string, unknown>)[key], `${at}.${key}`)
            : [`${at}.${key}: missing in the service's response`]));
    }
    return [];
};

const expectShape = (name: string, expected: unknown, actual: unknown, { ignore = [] as string[] } = {}) => {
    const found = differences(expected, actual).filter((difference) => !ignore.some((path) => difference.startsWith(`${path}:`) || difference.startsWith(`${path}.`)));
    expect(found, `${name}: factory vs. real response`).toEqual([]);
};

test.describe('fixture factories match the real APIs', () => {
    test('core: the logged-in member and their permissions', async ({ api }) => {
        const me = await api.call<Envelope<unknown>>('member', 'GET', '/api/core/members/me');
        // The factory adds a primary body; the seeded member has none, so it's null there.
        expectShape('member', factories.member({ event_application_ban: null }), me.body.data);

        const permissions = await api.call<Envelope<unknown[]>>('member', 'GET', '/api/core/my_permissions');
        expectShape('permission', [factories.permission('global:create:event')], permissions.body.data);

        const body = (await api.me('member')).bodies[0];
        const real = await api.call<Envelope<unknown>>('member', 'GET', `/api/core/bodies/${body.id}`);
        expectShape('body', factories.body(), real.body.data);
    });

    test('events: lists, a single event, its permissions and an application', async ({ api }) => {
        const event = await api.createEvent('admin', {
            type: 'training',
            questions: [{ type: 'select', description: 'Size', required: true, values: ['S', 'M'] }],
            locations: [{ name: 'Brussels', position: { lat: 50.85, lng: 4.35 } }]
        });
        await api.publishAsAdmin(event.id);

        const list = await api.call<Envelope<unknown[]>>('member', 'GET', '/api/events/?limit=200');
        const listed = list.body.data.find((item) => (item as { id: number }).id === event.id);
        expect(listed, 'the new event is listed').toBeTruthy();
        expectShape('event summary', factories.eventSummary({ locations: [{ name: 'x', position: { lat: 1, lng: 1 } }] }), listed);

        const single = await api.call<Envelope<unknown> & { permissions: unknown }>('member', 'GET', `/api/events/single/${event.url}`);
        // Members don't get the organisers' fields (budget, programme, organizers): optional in the factory.
        expectShape('event', factories.event({ questions: [factories.question({ type: 'select' })] }), single.body.data);
        expectShape('event permissions', factories.eventPermissions(), single.body.permissions, { ignore: ['$.set_board_comment', '$.see_boardview'] });

        const member = await api.me('member');
        const created = await api.call<Envelope<unknown>>('member', 'POST', `/api/events/single/${event.id}/applications`, {
            body_id: member.bodies[0].id, answers: ['S'], agreed_to_privacy_policy: true
        });
        expect(created.status, JSON.stringify(created.body)).toBe(200);
        const application = await api.call<Envelope<unknown>>('member', 'GET', `/api/events/single/${event.id}/applications/me`);
        expectShape('application', factories.application({ answers: ['S'] }), application.body.data);
    });

    test('events: validation errors and unknown items', async ({ api }) => {
        const event = await api.createEvent('admin', { questions: [{ type: 'string', description: 'Why?', required: true }] });
        await api.publishAsAdmin(event.id);
        const member = await api.me('member');

        const invalid = await api.call('member', 'POST', `/api/events/single/${event.id}/applications`, { body_id: member.bodies[0].id, answers: [''], agreed_to_privacy_policy: false });
        expect(invalid.status).toBe(422);
        expectShape('validation error', factories.validationError({ answers: ['x'], agreed_to_privacy_policy: ['x'] }), invalid.body);

        const missing = await api.call('member', 'GET', `/api/events/single/${event.id}/applications/me`);
        expect(missing.status).toBe(404);
        expectShape('not found', factories.notFound('x'), missing.body);
    });
});
