// Generic answers for every API call, so any page can render without a backend: lists come back
// empty and the "single item" endpoints return one plausible object. The smoke and
// accessibility runs (smoke/, a11y/) use these; the behavioural specs mock exactly what they need.
import type { ApiMock } from './api-mock.ts';
import { body, event, eventPermissions, eventSummary, member, ok, question } from './factories.ts';

export const mockEverything = (api: ApiMock): void => {
    // Registered first, so everything below (and anything a test adds) takes precedence.
    api.on('GET * *', { json: ok([], { meta: { count: 0 } }) });
    for (const service of ['core', 'events', 'summeruniversity', 'statutory', 'discounts', 'network', 'mailer']) {
        api.on(`GET ${service} *`, { json: ok([], { meta: { count: 0 } }) });
        for (const method of ['POST', 'PUT', 'DELETE']) api.on(`${method} ${service} *`, { json: ok({}) });
    }

    // POST /my_permissions answers "where may I do X" with a list of lists of circles.
    api.json('POST core /my_permissions', ok([]));

    // A few events of different kinds, so lists and cards render (and get checked by axe).
    const events = [
        eventSummary({ id: 11, name: 'Spring Training', type: 'training', fee: 50 }),
        eventSummary({ id: 12, name: 'Network Meeting Utrecht', type: 'nwm', fee: 0, application_status: 'closed' }),
        eventSummary({ id: 13, name: 'Online Conference', type: 'conference', method: 'online', has_applications: false })
    ];
    api.json('GET events /', ok(events));
    api.json('GET events /mine/organizing', ok(events));
    // "Mine" also has the member's application (events/lib/events.js, listUserAppliedEvents).
    api.json('GET events /mine/participating', ok(events.map((item) => ({ ...item, applications: [{ user_id: 1, status: 'pending' }] }))));

    const organizers = [{ user_id: 1, first_name: 'Ada', last_name: 'Admin', comment: '' }];
    const sampleEvent = event({
        id: 1,
        url: '1',
        organizers,
        budget: null,
        programme: null,
        is_european_event: false,
        questions: [
            question({ type: 'string', description: 'Why do you want to join?', required: true }),
            question({ type: 'checkbox', description: 'I am vegetarian' }),
            question({ type: 'select', description: 'T-shirt size', values: ['S', 'M', 'L'] })
        ]
    });
    api.json('GET events /single/:id', ok(sampleEvent, { permissions: eventPermissions() }));
    api.json('GET summeruniversity /single/:id', ok({ ...sampleEvent, status: 'first draft', questions: [], cooperation: [], courses: [] }, { permissions: eventPermissions() }));
    api.json('GET core /bodies/:id', ok(body({ id: 1 })));
    api.json('GET core /members/:id', ok(member({ id: 1 })));
    api.json('GET core /members/unconfirmed', ok([], { meta: { count: 0 } }));

    // statutory puts the permissions inside `data`.
    api.json('GET statutory /events/:id', ok({
        ...event({ id: 1, url: 'agora-spring', name: 'Agora Spring' }),
        type: 'agora',
        questions: [],
        positions: [],
        question_lines: [],
        permissions: {
            see_boardview: {},
            edit_event: true,
            delete_event: true,
            apply: true,
            see_applications: true,
            approve_participants: true,
            manage_question_lines: true,
            manage_candidates: true,
            set_memberslists_fee_paid: true,
            upload_memberslist: {},
            see_memberslist: {},
            manage_membership_fee: {}
        }
    }));
};
