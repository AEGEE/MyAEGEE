// Answers for the pages of the area `summeruniversity` in the smoke and accessibility runs
// (see index.ts).
import type { ApiMock } from '../api-mock.ts';
import { notFound, ok } from '../factories/base.ts';
import { suEvent, suPermissions, suSeason, suStats } from '../factories/summeruniversity.ts';

export const smoke = (api: ApiMock): void => {
    // An SU in its first draft, without locations (a map needs its own answers), photos and
    // social media links.
    api.json('GET summeruniversity /single/:id', ok(
        suEvent({ id: 1, url: '1', status: 'first draft', locations: [], photos: [], social_media: [] }),
        { permissions: suPermissions({ apply: false }) }
    ));
    api.json('GET summeruniversity /seasons', ok([suSeason({ year: 2027 })]));
    // The member hasn't applied yet: the application form.
    api.on('GET summeruniversity /single/:id/applications/:application_id', { status: 404, json: notFound('Application with id me not found') });
    // The statistics of the season.
    api.json('GET summeruniversity /applications', ok(suStats()));
};

// Route name -> values for the parameters of its path (the default is '1').
export const params: Record<string, Record<string, string>> = {};

// Routes that send the viewer on: where to, and the title of that page.
export const redirects: Record<string, { url: string; title: string }> = {};

// Error messages that are the expected result of the generic answers.
export const expectedAlerts: Record<string, RegExp> = {};
