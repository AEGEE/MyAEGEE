// Answers for the pages of the area `summeruniversity` in the smoke and accessibility runs
// (see index.ts).
import type { ApiMock } from '../api-mock.ts';
import { ok } from '../factories/base.ts';
import { event, eventPermissions } from '../factories/events.ts';

export const smoke = (api: ApiMock): void => {
    api.json('GET summeruniversity /single/:id', ok({
        ...event({ id: 1, url: '1', organizers: [{ user_id: 1, first_name: 'Ada', last_name: 'Admin' }], budget: null, programme: null }),
        status: 'first draft',
        questions: [],
        cooperation: [],
        courses: []
    }, { permissions: eventPermissions() }));
    api.json('GET summeruniversity /seasons', ok([{
        year: 2027,
        name: 'Summer University 2027',
        active: true,
        event_submission_deadline: '2026-12-01T00:00:00.000Z',
        application_period_starts: '2027-03-01T00:00:00.000Z',
        application_period_ends: '2027-04-01T00:00:00.000Z'
    }]));
};

// Route name -> values for the parameters of its path (the default is '1').
export const params: Record<string, Record<string, string>> = {};

// Routes that send the viewer on: where to, and the title of that page.
export const redirects: Record<string, { url: string; title: string }> = {};

// Error messages that are the expected result of the generic answers.
export const expectedAlerts: Record<string, RegExp> = {};
