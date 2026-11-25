// Answers for the pages of the area `resources` in the smoke and accessibility runs (see index.ts).
import type { ApiMock } from '../api-mock.ts';
import { ok } from '../factories/base.ts';
import { resourceCategory, resourceLink } from '../factories/static.ts';

// The section and the link the edit forms open, so they show their fields filled in. The list
// of sections (`GET core /resources`) stays the generic empty one: the Resources page of the
// area `static` reads it too.
export const smoke = (api: ApiMock): void => {
    const link = resourceLink({ id: 1, category_id: 1, title: 'AEGEE Newsletter', description: 'News from the network, every month.' });
    api.json('GET core /resources/categories/:id', ok(resourceCategory({ id: 1, name: 'Stay informed', links: [link] })));
    api.json('GET core /resources/links/:id', ok(link));
};

// Route name -> values for the parameters of its path (the default is '1').
export const params: Record<string, Record<string, string>> = {};

// Routes that send the viewer on: where to, and the title of that page.
export const redirects: Record<string, { url: string; title: string }> = {};

// Error messages that are the expected result of the generic answers.
export const expectedAlerts: Record<string, RegExp> = {};
