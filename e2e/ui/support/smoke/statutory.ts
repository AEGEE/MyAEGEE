// Answers for the pages of the area `statutory` in the smoke and accessibility runs
// (see index.ts).
import type { ApiMock } from '../api-mock.ts';
import { ok } from '../factories/base.ts';
import { body } from '../factories/core.ts';
import { singleStatutoryApplication } from '../factories/statutory-applications.ts';
import { allStatutoryPermissions, statutoryEvent } from '../factories/statutory-events.ts';
import { applicationFields, incomingApplicationFields, statutoryStats } from '../factories/statutory-stats.ts';

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
    api.json('GET statutory /events/:id/applications/stats', ok(statutoryStats()));
    // The export page offers one checkbox per field of an application.
    api.json('GET statutory /events/:id/fields/applications/all', ok(applicationFields()));
    api.json('GET statutory /events/:id/fields/applications/incoming', ok(incomingApplicationFields()));
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
