// Answers for the pages of the area `core` in the smoke and accessibility runs (see index.ts).
import type { ApiMock } from '../api-mock.ts';
import { ok, okList } from '../factories/base.ts';
import { body, member } from '../factories/core.ts';

export const smoke = (api: ApiMock): void => {
    // POST /my_permissions answers "in which circles may I do X" with a list of circles.
    api.json('POST core /my_permissions', ok([]));
    api.json('GET core /bodies/:id', ok(body({ id: 1 })));
    api.json('GET core /members/:id', ok(member({ id: 1 })));
    api.json('GET core /members/unconfirmed', okList([]));
};

// Route name -> values for the parameters of its path (the default is '1').
export const params: Record<string, Record<string, string>> = {};

// Routes that send the viewer on: where to, and the title of that page.
export const redirects: Record<string, { url: string; title: string }> = {
    // A complete profile has nothing to update (UpdateProfile.vue).
    'oms.profile.update': { url: '/dashboard', title: 'MyAEGEE | Dashboard' }
};

// Error messages that are the expected result of the generic answers.
export const expectedAlerts: Record<string, RegExp> = {};
