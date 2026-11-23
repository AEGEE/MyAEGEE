// Answers for the pages of the area `statutory` in the smoke and accessibility runs
// (see index.ts).
import type { ApiMock } from '../api-mock.ts';
import { ok } from '../factories/base.ts';
import { body } from '../factories/core.ts';
import { singleStatutoryApplication } from '../factories/statutory-applications.ts';
import { allStatutoryPermissions, statutoryEvent } from '../factories/statutory-events.ts';

export const smoke = (api: ApiMock): void => {
    // statutory puts the permissions inside `data`: here every permission, as a superadmin has.
    api.json('GET statutory /events/:id', ok(statutoryEvent({
        questions: [
            { type: 'string', description: 'What do you expect from this Agora?', required: true },
            { type: 'checkbox', description: 'I need a visa', required: false },
            { type: 'select', description: 'Meal preference', required: true, values: ['Meat', 'Vegetarian', 'Vegan'] }
        ],
        permissions: allStatutoryPermissions()
    })));
    // The member's own application, which they may edit.
    api.json('GET statutory /events/:id/applications/me', ok(singleStatutoryApplication({
        answers: ['To meet the Network', false, 'Vegetarian'],
        editable_bodies: [body({ id: 1 })]
    }, allStatutoryPermissions())));
    // The statistics page draws its charts from these.
    api.json('GET statutory /events/:id/applications/stats', ok({
        numbers: { total: 3, cancelled: 0, pending: 1, waiting_list: 0, rejected: 0, accepted: 2, confirmed: 1, attended: 0, registered: 0, departed: 0 },
        by_date: [{ date: '2027-01-10', value: 2 }, { date: '2027-01-11', value: 1 }],
        by_date_cumulative: [{ date: '2027-01-10', value: 2 }, { date: '2027-01-11', value: 3 }],
        by_body: [{ type: 1, value: 3 }],
        by_type: [{ type: 'delegate', value: 2 }, { type: 'visitor', value: 1 }],
        by_gender: [{ type: 'Female', value: 2 }, { type: 'male', value: 1 }],
        by_meal: [{ type: 'Vegetarian', value: 3 }],
        by_number_of_events_visited: [{ type: '0', value: 3 }],
        quorum: { accepted_only: false, body_ids: [1] }
    }));
    // The export page offers one checkbox per field of an application.
    const fields = { first_name: 'First name', last_name: 'Last name', body_name: 'Body', participant_type: 'Participant type' };
    api.json('GET statutory /events/:id/fields/applications/all', ok(fields));
    api.json('GET statutory /events/:id/fields/applications/incoming', ok(fields));
};

// Route name -> values for the parameters of its path (the default is '1').
export const params: Record<string, Record<string, string>> = {
    // The positions page lists one kind of position: this is a status, not an event.
    'oms.statutory.positions': { prefix: 'approved' }
};

// Routes that send the viewer on: where to, and the title of that page.
export const redirects: Record<string, { url: string; title: string }> = {};

// Error messages that are the expected result of the generic answers.
export const expectedAlerts: Record<string, RegExp> = {};
