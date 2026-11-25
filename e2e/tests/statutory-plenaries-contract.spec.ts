// Checks the builders the mocked-API suite uses for the plenaries and question lines of
// statutory events (ui/support/factories/statutory-plenaries.ts) against what statutory really
// answers. See tests/core-contract.spec.ts for how the comparison works.
import type { Envelope } from '../support/api.ts';
import { test, expectStatus } from '../support/api.ts';
import { expectShape } from '../support/contract.ts';
import { acceptedDelegate, makeChair } from '../support/statutory-plenaries-data.ts';
import {
    plenaryAttendance,
    statutoryPlenary,
    statutoryPlenaryWithAttendances,
    statutoryQuestionLine,
    statutoryQuestionLineQuestion
} from '../ui/support/factories/statutory-plenaries.ts';

const HOUR = 60 * 60 * 1000;

test.describe('statutory plenary and question line factories match the real API', () => {
    test('a plenary, its list and its attendances', async ({ api }) => {
        const removeChair = await makeChair(api, 'chair');
        try {
            const event = await api.createStatutoryEvent();
            expectStatus(await api.call('admin', 'PUT', `/api/statutory/events/${event.id}/status`, { status: 'published' }), 200);
            const delegate = await acceptedDelegate(api, event, 'member');
            const base = `/api/statutory/events/${event.id}/plenaries`;

            const created = await api.call<Envelope<{ id: number }>>('chair', 'POST', base, {
                name: 'Opening plenary', starts: new Date(Date.now() - HOUR), ends: new Date(Date.now() + HOUR)
            });
            expectStatus(created, 200);
            expectShape('statutoryPlenary', statutoryPlenary(), created.body.data);

            const list = await api.call<Envelope<unknown[]>>('chair', 'GET', base);
            expectStatus(list, 200);
            expectShape('statutoryPlenary', statutoryPlenary(), list.body.data[0]);

            // Marked in: the attendance has no end yet.
            const marked = await api.call<Envelope<unknown>>('chair', 'POST', `${base}/${created.body.data.id}/attendance/mark`, { application_id: delegate.statutory_id });
            expectStatus(marked, 200);
            // Its end is compared once the delegate has left, below.
            expectShape('plenaryAttendance', plenaryAttendance(), marked.body.data);

            // Marked out, and the plenary with that attendance.
            expectStatus(await api.call('chair', 'POST', `${base}/${created.body.data.id}/attendance/mark`, { application_id: delegate.id }), 200);
            const plenary = await api.call<Envelope<unknown>>('chair', 'GET', `${base}/${created.body.data.id}`);
            expectStatus(plenary, 200);
            expectShape('statutoryPlenaryWithAttendances', statutoryPlenaryWithAttendances({
                attendances: [plenaryAttendance({ ends: new Date().toISOString() })]
            }), plenary.body.data);
            expectShape('plenaryAttendance', plenaryAttendance({ ends: new Date().toISOString() }), (plenary.body.data as { attendances: unknown[] }).attendances[0]);
        } finally {
            await removeChair();
        }
    });

    test('a question line with its questions', async ({ api }) => {
        const event = await api.createStatutoryEvent();
        expectStatus(await api.call('admin', 'PUT', `/api/statutory/events/${event.id}/status`, { status: 'published' }), 200);
        const applied = await acceptedDelegate(api, event, 'member');
        // Who has a confirmed application may ask questions.
        expectStatus(await api.call('admin', 'PUT', `/api/statutory/events/${event.id}/applications/${applied.id}/confirmed`, { confirmed: true }), 200);
        const base = `/api/statutory/events/${event.id}/question-lines`;

        const line = await api.call<Envelope<{ id: number }>>('admin', 'POST', base, { name: 'CD candidates' });
        expectStatus(line, 200);
        expectShape('statutoryQuestionLine', statutoryQuestionLine({ questions: undefined }), line.body.data);
        expectStatus(await api.call('member', 'POST', `${base}/${line.body.data.id}/questions`, { text: 'A' }), 200);

        const lines = await api.call<Envelope<{ questions: unknown[] }[]>>('member', 'GET', base);
        expectStatus(lines, 200);
        expectShape('statutoryQuestionLine', statutoryQuestionLine(), lines.body.data[0]);
        expectShape('statutoryQuestionLineQuestion', statutoryQuestionLineQuestion(), lines.body.data[0].questions[0]);
    });
});
