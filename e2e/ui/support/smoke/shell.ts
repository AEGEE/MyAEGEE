// Answers for the pages of the area `shell` in the smoke and accessibility runs (see index.ts).
import type { ApiMock } from '../api-mock.ts';

// Nothing yet: the shell asks for nothing beyond what every test already answers.
export const smoke: (api: ApiMock) => void = () => {};

// Route name -> values for the parameters of its path (the default is '1').
export const params: Record<string, Record<string, string>> = {};

// Routes that send the viewer on: where to, and the title of that page.
export const redirects: Record<string, { url: string; title: string }> = {};

// Error messages that are the expected result of the generic answers.
export const expectedAlerts: Record<string, RegExp> = {};
