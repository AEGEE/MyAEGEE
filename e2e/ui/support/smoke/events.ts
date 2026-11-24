// Answers for the pages of the area `events` in the smoke and accessibility runs (see index.ts).
import type { ApiMock } from '../api-mock.ts';
import { notFound, ok } from '../factories/base.ts';
import { event, eventPermissions, eventSummary, organizer, participatingEvent, question } from '../factories/events.ts';
import { mockMap } from '../map.ts';

export const smoke = (api: ApiMock): void => {
    // A few events of different kinds, so lists and cards render (and get checked by axe).
    const events = [
        eventSummary({ id: 11, name: 'Spring Training', type: 'training', fee: 50 }),
        eventSummary({ id: 12, name: 'Network Meeting Utrecht', type: 'nwm', fee: 0, application_status: 'closed' }),
        eventSummary({ id: 13, name: 'Online Conference', type: 'conference', method: 'online', has_applications: false })
    ];
    api.json('GET events /', ok(events));
    api.json('GET events /mine/organizing', ok(events));
    // "Mine" also has the member's application (events/lib/events.js, listUserAppliedEvents).
    api.json('GET events /mine/participating', ok(events.map((item) => participatingEvent(item))));

    api.json('GET events /single/:id', ok(event({
        id: 1,
        url: '1',
        organizers: [organizer({ user_id: 1, first_name: 'Ada', last_name: 'Admin' })],
        budget: null,
        programme: null,
        is_european_event: false,
        questions: [
            question({ type: 'string', description: 'Why do you want to join?', required: true }),
            question({ type: 'checkbox', description: 'I am vegetarian' }),
            question({ type: 'select', description: 'T-shirt size', values: ['S', 'M', 'L'] })
        ]
    }), { permissions: eventPermissions() }));
    // The member hasn't applied yet: the application form.
    api.on('GET events /single/:id/applications/:application_id', { status: 404, json: notFound('Application with id me not found') });
    // The editor shows a map for in-person events.
    mockMap(api);
};

// Route name -> values for the parameters of its path (the default is '1').
export const params: Record<string, Record<string, string>> = {};

// Routes that send the viewer on: where to, and the title of that page.
export const redirects: Record<string, { url: string; title: string }> = {};

// Error messages that are the expected result of the generic answers.
export const expectedAlerts: Record<string, RegExp> = {};
