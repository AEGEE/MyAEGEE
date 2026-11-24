// Question lines of a statutory event (/statutory/:id/question-lines): the lines and their
// status, the questions of the selected line, asking, editing and deleting questions, and
// managing the lines in their modal.
import type { Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { forbidden, notFound, ok, validationError } from '../support/factories/base.ts';
import { statutoryEvent, statutoryEventPermissions, type StatutoryEventPermissions } from '../support/factories/statutory-events.ts';
import { statutoryQuestionLine, statutoryQuestionLineQuestion, type StatutoryQuestionLine } from '../support/factories/statutory-plenaries.ts';
import { cellOf, dialog, expectEmptyTable, tableRows, toast } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { test, expect } from '../support/test.ts';

const MANAGER = statutoryEventPermissions({ manage_question_lines: true, see_question_lines: true, see_questions: true });
// A confirmed participant may see and ask questions.
const PARTICIPANT = statutoryEventPermissions({ see_questions: true, submit_questions: true });
// Someone who may see the lines without taking part.
const WATCHER = statutoryEventPermissions({ see_question_lines: true, see_questions: true });

// Alex Member (the logged-in member, user 2) asks with application 12; Jan Jansen (user 7)
// with application 14.
const ALEX = { id: 12, user_id: 2, first_name: 'Alex', last_name: 'Member', body_name: 'AEGEE-Antenna', participant_type: 'visitor' as const };
const JAN = { id: 14, user_id: 7, first_name: 'Jan', last_name: 'Jansen', body_name: 'AEGEE-Utrecht', participant_type: 'delegate' as const };

const candidates = (): StatutoryQuestionLine => statutoryQuestionLine({
    id: 4,
    event_id: 5,
    name: 'CD candidates',
    status: 'open',
    questions: [
        statutoryQuestionLineQuestion({ id: 8, question_line_id: 4, text: 'Question to one candidate', updated_at: '2027-03-02T08:15:00.000Z', application: JAN }),
        statutoryQuestionLineQuestion({ id: 9, question_line_id: 4, text: 'Question to all candidates', updated_at: '2027-07-15T08:20:00.000Z', application: ALEX })
    ]
});
const elections = (): StatutoryQuestionLine => statutoryQuestionLine({
    id: 5,
    event_id: 5,
    name: 'Elections',
    status: 'closed',
    questions: [statutoryQuestionLineQuestion({ id: 10, question_line_id: 5, text: 'An objection', application: ALEX })]
});
const activities = (): StatutoryQuestionLine => statutoryQuestionLine({ id: 6, event_id: 5, name: 'Activity plan', status: 'open', questions: [] });

// What the list of question lines answers from now on.
const answerLines = (api: ApiMock, lines: StatutoryQuestionLine[]): void => {
    api.json('GET statutory /events/:id/question-lines', ok(lines));
};

const showLines = (api: ApiMock, permissions: StatutoryEventPermissions = MANAGER, lines: StatutoryQuestionLine[] = [candidates(), elections(), activities()]): void => {
    api.json('GET statutory /events/:id', ok(statutoryEvent({ id: 5, url: 'agora-spring', permissions })));
    answerLines(api, lines);
};

const linesTable = (page: Page) => page.getByRole('region', { name: 'Question lines' }).getByRole('table');
const lineRow = (page: Page, name: string) => tableRows(linesTable(page)).filter({ hasText: name });
const questionsOf = (page: Page, line: string) => page.getByRole('region', { name: `Questions of ${line}` });
const questionRow = (page: Page, line: string, text: string) => tableRows(questionsOf(page, line).getByRole('table')).filter({ hasText: text });

// Selects a line the way a member does: a click on its row.
const selectLine = async (page: Page, name: string): Promise<void> => {
    await (await cellOf(linesTable(page), lineRow(page, name), 'Name')).click();
    await expect(questionsOf(page, name)).toBeVisible();
};

test.describe('question lines', () => {
    test('who manages the question lines sees every line with its status and can manage them', async ({ page, api }) => {
        showLines(api);

        await page.goto('/statutory/agora-spring/question-lines');

        await expect(page.getByRole('heading', { name: 'Question lines list', exact: true })).toBeVisible();
        await expect(page).toHaveTitle('MyAEGEE | Question lines list for Agora');
        await expect(page.getByRole('button', { name: 'Create a question line' })).toBeVisible();
        const table = linesTable(page);
        await expect(tableRows(table)).toHaveCount(3);
        const first = lineRow(page, 'CD candidates');
        await expect(await cellOf(table, first, '#')).toHaveText('1');
        await expect(await cellOf(table, first, 'Questions')).toHaveText('2');
        await expect(page.getByRole('combobox', { name: 'Status of CD candidates' })).toHaveValue('open');
        await expect(page.getByRole('combobox', { name: 'Status of Elections' })).toHaveValue('closed');
        await expect(first.getByRole('button', { name: 'Edit' })).toBeVisible();
        await expect(first.getByRole('button', { name: 'Delete' })).toBeVisible();
        await expect(await cellOf(table, lineRow(page, 'Elections'), '#')).toHaveText('2');
        await expect(await cellOf(table, lineRow(page, 'Activity plan'), 'Questions')).toHaveText('0');
        // Managers who are no confirmed participant can't ask.
        await expect(await cellOf(table, first, 'Ask a question')).toHaveText('You are not a confirmed participant.');
        await expect(await cellOf(table, lineRow(page, 'Elections'), 'Ask a question')).toHaveText('The question line is closed.');
        // No line is selected yet.
        await expect(page.getByRole('region', { name: /^Questions of/ })).toHaveCount(0);

        await selectLine(page, 'CD candidates');
        const questions = questionsOf(page, 'CD candidates').getByRole('table');
        await expect(tableRows(questions)).toHaveCount(2);
        const jan = questionRow(page, 'CD candidates', 'Question to one candidate');
        await expect(await cellOf(questions, jan, '#')).toHaveText('1');
        await expect(await cellOf(questions, jan, 'Participant')).toHaveText('Jan Jansen, AEGEE-Utrecht');
        await expect(await cellOf(questions, jan, 'Participant type')).toHaveText('delegate');
        await expect(await cellOf(questions, jan, 'Last updated on')).toHaveText('2027-03-02 09:15');
        await expect(await cellOf(questions, questionRow(page, 'CD candidates', 'Question to all candidates'), 'Last updated on')).toHaveText('2027-07-15 10:20');
        await expect(jan.getByRole('button', { name: 'Edit' })).toBeVisible();
        await expect(jan.getByRole('button', { name: 'Delete' })).toBeVisible();

        // Also the questions of a closed line.
        await selectLine(page, 'Elections');
        await expect(questionRow(page, 'Elections', 'An objection').getByRole('button', { name: 'Edit' })).toBeVisible();
        await expect(questionRow(page, 'Elections', 'An objection').getByRole('button', { name: 'Delete' })).toBeVisible();
        await expect(questionsOf(page, 'CD candidates')).toHaveCount(0);
    });

    test('a confirmed participant sees the status of each line and may ask in the open ones', async ({ page, api }) => {
        showLines(api, PARTICIPANT);

        await page.goto('/statutory/agora-spring/question-lines');

        const table = linesTable(page);
        await expect(await cellOf(table, lineRow(page, 'CD candidates'), 'Status')).toHaveText('open');
        await expect(await cellOf(table, lineRow(page, 'Elections'), 'Status')).toHaveText('closed');
        await expect(lineRow(page, 'CD candidates').getByRole('button', { name: 'Ask a question!' })).toBeVisible();
        await expect(lineRow(page, 'Activity plan').getByRole('button', { name: 'Ask a question!' })).toBeVisible();
        await expect(lineRow(page, 'Elections').getByRole('button', { name: 'Ask a question!' })).toHaveCount(0);
        await expect(await cellOf(table, lineRow(page, 'Elections'), 'Ask a question')).toHaveText('The question line is closed.');
        // Nothing to manage.
        await expect(page.getByRole('button', { name: 'Create a question line' })).toHaveCount(0);
        await expect(page.getByRole('combobox')).toHaveCount(0);
        await expect(lineRow(page, 'CD candidates').getByRole('button', { name: 'Edit' })).toHaveCount(0);
        await expect(lineRow(page, 'CD candidates').getByRole('button', { name: 'Delete' })).toHaveCount(0);

        await selectLine(page, 'CD candidates');
        await expect(await cellOf(questionsOf(page, 'CD candidates').getByRole('table'), questionRow(page, 'CD candidates', 'Question to one candidate'), 'Participant'))
            .toHaveText('Jan Jansen, AEGEE-Utrecht');
        await expect(questionsOf(page, 'CD candidates').getByText('delegate')).toHaveCount(0);
    });

    test('who is no confirmed participant is told why they can\'t ask', async ({ page, api }) => {
        showLines(api, WATCHER);

        await page.goto('/statutory/agora-spring/question-lines');

        await expect(await cellOf(linesTable(page), lineRow(page, 'CD candidates'), 'Ask a question')).toHaveText('You are not a confirmed participant.');
        await expect(page.getByRole('button', { name: 'Ask a question!' })).toHaveCount(0);
    });

    test('a member may edit their own question while its line is open, and nobody else\'s', async ({ page, api }) => {
        showLines(api, PARTICIPANT);

        await page.goto('/statutory/agora-spring/question-lines');
        await selectLine(page, 'CD candidates');

        await expect(questionRow(page, 'CD candidates', 'Question to all candidates').getByRole('button', { name: 'Edit' })).toBeVisible();
        const others = questionRow(page, 'CD candidates', 'Question to one candidate');
        await expect(others.getByRole('button', { name: 'Edit' })).toHaveCount(0);
        await expect(others.getByRole('button', { name: 'Delete' })).toHaveCount(0);

        // Their question in a closed line can't be changed any more.
        await selectLine(page, 'Elections');
        await expect(questionRow(page, 'Elections', 'An objection').getByRole('button', { name: 'Edit' })).toHaveCount(0);
    });

    test('a line without questions says so', async ({ page, api }) => {
        showLines(api, MANAGER, [activities()]);

        await page.goto('/statutory/agora-spring/question-lines');
        await selectLine(page, 'Activity plan');

        await expectEmptyTable(questionsOf(page, 'Activity plan').getByRole('table'));
    });

    test('an event without question lines says so', async ({ page, api }) => {
        showLines(api, PARTICIPANT, []);

        await page.goto('/statutory/agora-spring/question-lines');

        await expectEmptyTable(linesTable(page));
    });

    test('a participant asks a question, and sees it in the line without reloading the page', async ({ page, api }) => {
        showLines(api, PARTICIPANT);
        const asked = statutoryQuestionLineQuestion({ id: 11, question_line_id: 6, text: 'B', application: ALEX });
        api.json('POST statutory /events/:id/question-lines/:question_line_id/questions', ok({ ...asked, application: undefined }));

        await page.goto('/statutory/agora-spring/question-lines');
        await selectLine(page, 'Activity plan');
        await lineRow(page, 'Activity plan').getByRole('button', { name: 'Ask a question!' }).click();
        const form = dialog(page, 'Ask a question');
        await expect(form.getByRole('heading', { name: 'Ask a question' })).toBeVisible();
        await expect(form.getByLabel('Text')).toHaveValue('');
        await form.getByLabel('Text').fill('B');
        answerLines(api, [candidates(), elections(), { ...activities(), questions: [asked] }]);
        await form.getByRole('button', { name: 'Save changes' }).click();

        await expect(toast(page, 'Question is created.')).toBeVisible();
        await expect(form).toHaveCount(0);
        await expect(questionRow(page, 'Activity plan', 'B')).toHaveCount(1);
        await expect(await cellOf(linesTable(page), lineRow(page, 'Activity plan'), 'Questions')).toHaveText('1');
        // Asked in the line of the event's id, with the text only.
        expect(api.callsTo('POST statutory /events/:id/question-lines/:question_line_id/questions').map((call) => [call.params, call.body]))
            .toEqual([[{ id: '5', question_line_id: '6' }, { text: 'B' }]]);
        expect(api.callsTo('GET statutory /events/:id/question-lines')).toHaveLength(2);
    });

    test('a question is asked once, however often Save is clicked', async ({ page, api }) => {
        showLines(api, PARTICIPANT);
        api.on('POST statutory /events/:id/question-lines/:question_line_id/questions', { json: ok(statutoryQuestionLineQuestion()), delayMs: 1000 });

        await page.goto('/statutory/agora-spring/question-lines');
        await lineRow(page, 'CD candidates').getByRole('button', { name: 'Ask a question!' }).click();
        await dialog(page, 'Ask a question').getByLabel('Text').fill('A');
        const save = dialog(page, 'Ask a question').getByRole('button', { name: 'Save changes' });
        await save.click();

        await expect(save).toBeDisabled();
        await expect(toast(page, 'Question is created.')).toBeVisible();
        expect(api.callsTo('POST statutory /events/:id/question-lines/:question_line_id/questions')).toHaveLength(1);
    });

    test('a question without text is refused at its field', async ({ page, api }) => {
        showLines(api, PARTICIPANT);
        api.on('POST statutory /events/:id/question-lines/:question_line_id/questions', {
            status: 422, json: validationError({ text: ['Question text should be set.'] })
        });

        await page.goto('/statutory/agora-spring/question-lines');
        await lineRow(page, 'CD candidates').getByRole('button', { name: 'Ask a question!' }).click();
        const form = dialog(page, 'Ask a question');
        await form.getByRole('button', { name: 'Save changes' }).click();

        await expect(toast(page, 'Some fields were not set')).toBeVisible();
        await expect(form.getByText('Question text should be set.')).toBeVisible();
        await expect(form.getByRole('button', { name: 'Save changes' })).toBeEnabled();
    });

    test('a question in a line closed meanwhile is refused with the reason', async ({ page, api }) => {
        showLines(api, PARTICIPANT);
        api.on('POST statutory /events/:id/question-lines/:question_line_id/questions', {
            status: 403, json: forbidden('The question line is closed, you cannot ask questions now.')
        });

        await page.goto('/statutory/agora-spring/question-lines');
        await lineRow(page, 'CD candidates').getByRole('button', { name: 'Ask a question!' }).click();
        const form = dialog(page, 'Ask a question');
        await form.getByLabel('Text').fill('A');
        await form.getByRole('button', { name: 'Save changes' }).click();

        await expect(toast(page, 'Some error happened: The question line is closed, you cannot ask questions now.')).toBeVisible();
        await expect(form.getByRole('button', { name: 'Save changes' })).toBeEnabled();
    });

    test('a member edits their own question', async ({ page, api }) => {
        showLines(api, PARTICIPANT);
        api.json('PUT statutory /events/:id/question-lines/:question_line_id/questions/:question_id', ok({ id: 9, text: 'Question to two candidates' }));

        await page.goto('/statutory/agora-spring/question-lines');
        await selectLine(page, 'CD candidates');
        await questionRow(page, 'CD candidates', 'Question to all candidates').getByRole('button', { name: 'Edit' }).click();
        const form = dialog(page, 'Edit question');
        await expect(form.getByRole('heading', { name: 'Edit question' })).toBeVisible();
        await expect(form.getByLabel('Text')).toHaveValue('Question to all candidates');
        await form.getByLabel('Text').fill('Question to two candidates');
        const edited = candidates();
        edited.questions[1].text = 'Question to two candidates';
        answerLines(api, [edited, elections(), activities()]);
        await form.getByRole('button', { name: 'Save changes' }).click();

        await expect(toast(page, 'Question is updated.')).toBeVisible();
        await expect(form).toHaveCount(0);
        await expect(questionRow(page, 'CD candidates', 'Question to two candidates')).toHaveCount(1);
        expect(api.callsTo('PUT statutory /events/:id/question-lines/:question_line_id/questions/:question_id').map((call) => [call.params, call.body]))
            .toEqual([[{ id: '5', question_line_id: '4', question_id: '9' }, { text: 'Question to two candidates' }]]);
    });

    for (const close of ['Cancel', 'Close'] as const) {
        test(`"${close}" leaves a question as it was and sends nothing`, async ({ page, api }) => {
            showLines(api, PARTICIPANT);

            await page.goto('/statutory/agora-spring/question-lines');
            await selectLine(page, 'CD candidates');
            await questionRow(page, 'CD candidates', 'Question to all candidates').getByRole('button', { name: 'Edit' }).click();
            const form = dialog(page, 'Edit question');
            await form.getByLabel('Text').fill('Something else');
            await form.getByRole('button', { name: close, exact: true }).click();

            await expect(form).toHaveCount(0);
            await expect(questionRow(page, 'CD candidates', 'Question to all candidates')).toHaveCount(1);
            await expect(questionRow(page, 'CD candidates', 'Something else')).toHaveCount(0);
            expect(api.callsTo('* statutory /events/:id/question-lines/:question_line_id/questions/:question_id')).toEqual([]);
        });
    }

    test('who manages the question lines edits and deletes a question of a closed line', async ({ page, api }) => {
        showLines(api);
        api.json('PUT statutory /events/:id/question-lines/:question_line_id/questions/:question_id', ok({ id: 10, text: 'An objection (withdrawn)' }));
        api.json('DELETE statutory /events/:id/question-lines/:question_line_id/questions/:question_id', { success: true, message: 'Question is deleted.' });

        await page.goto('/statutory/agora-spring/question-lines');
        await selectLine(page, 'Elections');
        await questionRow(page, 'Elections', 'An objection').getByRole('button', { name: 'Edit' }).click();
        await dialog(page, 'Edit question').getByLabel('Text').fill('An objection (withdrawn)');
        const edited = elections();
        edited.questions[0].text = 'An objection (withdrawn)';
        answerLines(api, [candidates(), edited, activities()]);
        await dialog(page, 'Edit question').getByRole('button', { name: 'Save changes' }).click();
        await expect(toast(page, 'Question is updated.')).toBeVisible();

        await questionRow(page, 'Elections', 'An objection (withdrawn)').getByRole('button', { name: 'Delete' }).click();
        await dialog(page, 'Deleting a question').getByRole('button', { name: 'Delete question' }).click();

        await expect(toast(page, 'Question is deleted.')).toBeVisible();
        await expectEmptyTable(questionsOf(page, 'Elections').getByRole('table'));
        await expect(await cellOf(linesTable(page), lineRow(page, 'Elections'), 'Questions')).toHaveText('0');
        expect(api.callsTo('* statutory /events/:id/question-lines/:question_line_id/questions/:question_id').map((call) => [call.method, call.params]))
            .toEqual([
                ['PUT', { id: '5', question_line_id: '5', question_id: '10' }],
                ['DELETE', { id: 'agora-spring', question_line_id: '5', question_id: '10' }]
            ]);
    });

    test('deleting a question asks first, and Cancel keeps it', async ({ page, api }) => {
        showLines(api);

        await page.goto('/statutory/agora-spring/question-lines');
        await selectLine(page, 'CD candidates');
        await questionRow(page, 'CD candidates', 'Question to one candidate').getByRole('button', { name: 'Delete' }).click();
        const confirm = dialog(page, 'Deleting a question');
        await expect(confirm).toContainText('Are you sure you want to delete this question? This action cannot be undone.');
        await confirm.getByRole('button', { name: 'Cancel' }).click();

        await expect(confirm).toHaveCount(0);
        await expect(tableRows(questionsOf(page, 'CD candidates').getByRole('table'))).toHaveCount(2);
        expect(api.callsTo('DELETE statutory /events/:id/question-lines/:question_line_id/questions/:question_id')).toEqual([]);
    });

    test('a question that can\'t be deleted stays, and the reason is shown', async ({ page, api }) => {
        showLines(api);
        api.on('DELETE statutory /events/:id/question-lines/:question_line_id/questions/:question_id', { status: 404, json: notFound('Question is not found.') });

        await page.goto('/statutory/agora-spring/question-lines');
        await selectLine(page, 'CD candidates');
        await questionRow(page, 'CD candidates', 'Question to one candidate').getByRole('button', { name: 'Delete' }).click();
        await dialog(page, 'Deleting a question').getByRole('button', { name: 'Delete question' }).click();

        await expect(toast(page, 'Could not delete question: Question is not found.')).toBeVisible();
        await expect(tableRows(questionsOf(page, 'CD candidates').getByRole('table'))).toHaveCount(2);
    });

    test('who manages the question lines creates one, and the list shows it without reloading the page', async ({ page, api }) => {
        showLines(api, MANAGER, [candidates()]);
        const created = statutoryQuestionLine({ id: 7, event_id: 5, name: 'Budget', questions: [] });
        api.json('POST statutory /events/:id/question-lines', ok({ ...created, questions: undefined }));

        await page.goto('/statutory/agora-spring/question-lines');
        await page.getByRole('button', { name: 'Create a question line' }).click();
        const form = dialog(page, 'Add question line');
        await expect(form.getByRole('heading', { name: 'Add question line' })).toBeVisible();
        await form.getByLabel('Name').fill('Budget');
        answerLines(api, [candidates(), created]);
        await form.getByRole('button', { name: 'Save changes' }).click();

        await expect(toast(page, 'Question line is created.')).toBeVisible();
        await expect(form).toHaveCount(0);
        await expect(lineRow(page, 'Budget')).toHaveCount(1);
        expect(api.callsTo('POST statutory /events/:id/question-lines').map((call) => [call.params, call.body])).toEqual([[{ id: '5' }, { name: 'Budget' }]]);
    });

    test('a question line is created once, however often Save is clicked', async ({ page, api }) => {
        showLines(api, MANAGER, []);
        api.on('POST statutory /events/:id/question-lines', { json: ok(statutoryQuestionLine()), delayMs: 1000 });

        await page.goto('/statutory/agora-spring/question-lines');
        await page.getByRole('button', { name: 'Create a question line' }).click();
        await dialog(page, 'Add question line').getByLabel('Name').fill('Budget');
        const save = dialog(page, 'Add question line').getByRole('button', { name: 'Save changes' });
        await save.click();

        await expect(save).toBeDisabled();
        await expect(toast(page, 'Question line is created.')).toBeVisible();
        expect(api.callsTo('POST statutory /events/:id/question-lines')).toHaveLength(1);
    });

    test('who manages the question lines renames one, keeping its questions in view', async ({ page, api }) => {
        showLines(api);
        api.json('PUT statutory /events/:id/question-lines/:question_line_id', ok({ ...candidates(), name: 'Candidates for CD', questions: undefined }));

        await page.goto('/statutory/agora-spring/question-lines');
        await selectLine(page, 'CD candidates');
        await lineRow(page, 'CD candidates').getByRole('button', { name: 'Edit' }).click();
        const form = dialog(page, 'Edit question line');
        await expect(form.getByRole('heading', { name: 'Edit question line' })).toBeVisible();
        await expect(form.getByLabel('Name')).toHaveValue('CD candidates');
        await form.getByLabel('Name').fill('Candidates for CD');
        answerLines(api, [{ ...candidates(), name: 'Candidates for CD' }, elections(), activities()]);
        await form.getByRole('button', { name: 'Save changes' }).click();

        await expect(toast(page, 'Question line is updated.')).toBeVisible();
        await expect(lineRow(page, 'Candidates for CD')).toHaveCount(1);
        await expect(tableRows(questionsOf(page, 'Candidates for CD').getByRole('table'))).toHaveCount(2);
        // Only the name is sent.
        expect(api.callsTo('PUT statutory /events/:id/question-lines/:question_line_id').map((call) => [call.params, call.body]))
            .toEqual([[{ id: '5', question_line_id: '4' }, { name: 'Candidates for CD' }]]);
    });

    test('a selected line that someone else deleted meanwhile is no longer shown after saving', async ({ page, api }) => {
        showLines(api);
        const created = statutoryQuestionLine({ id: 7, event_id: 5, name: 'Budget', questions: [] });
        api.json('POST statutory /events/:id/question-lines', ok({ ...created, questions: undefined }));

        await page.goto('/statutory/agora-spring/question-lines');
        await selectLine(page, 'Elections');
        await page.getByRole('button', { name: 'Create a question line' }).click();
        await dialog(page, 'Add question line').getByLabel('Name').fill('Budget');
        answerLines(api, [candidates(), activities(), created]);
        await dialog(page, 'Add question line').getByRole('button', { name: 'Save changes' }).click();

        await expect(lineRow(page, 'Budget')).toHaveCount(1);
        await expect(lineRow(page, 'Elections')).toHaveCount(0);
        await expect(page.getByRole('region', { name: /^Questions of/ })).toHaveCount(0);
    });

    test('a question line without a name is refused at its field', async ({ page, api }) => {
        showLines(api);
        api.on('PUT statutory /events/:id/question-lines/:question_line_id', { status: 422, json: validationError({ name: ['Question line name should be set.'] }) });

        await page.goto('/statutory/agora-spring/question-lines');
        await lineRow(page, 'CD candidates').getByRole('button', { name: 'Edit' }).click();
        const form = dialog(page, 'Edit question line');
        await form.getByLabel('Name').fill('');
        await form.getByRole('button', { name: 'Save changes' }).click();

        await expect(toast(page, 'Some fields were not set')).toBeVisible();
        await expect(form.getByText('Question line name should be set.')).toBeVisible();
        await expect(form.getByRole('button', { name: 'Save changes' })).toBeEnabled();
    });

    test('a failure to save a question line says why', async ({ page, api }) => {
        showLines(api);
        api.on('POST statutory /events/:id/question-lines', { status: 500, json: { success: false, message: 'Internal server error.' } });

        await page.goto('/statutory/agora-spring/question-lines');
        await page.getByRole('button', { name: 'Create a question line' }).click();
        await dialog(page, 'Add question line').getByLabel('Name').fill('Budget');
        await dialog(page, 'Add question line').getByRole('button', { name: 'Save changes' }).click();

        await expect(toast(page, 'Some error happened: Internal server error.')).toBeVisible();
        await expect(dialog(page, 'Add question line')).toBeVisible();
    });

    for (const close of ['Cancel', 'Close'] as const) {
        test(`"${close}" leaves a question line as it was and sends nothing`, async ({ page, api }) => {
            showLines(api);

            await page.goto('/statutory/agora-spring/question-lines');
            await lineRow(page, 'CD candidates').getByRole('button', { name: 'Edit' }).click();
            const form = dialog(page, 'Edit question line');
            await form.getByLabel('Name').fill('Renamed line');
            await form.getByRole('button', { name: close, exact: true }).click();

            await expect(form).toHaveCount(0);
            await expect(lineRow(page, 'CD candidates')).toHaveCount(1);
            await expect(lineRow(page, 'Renamed line')).toHaveCount(0);
            expect(api.callsTo('* statutory /events/:id/question-lines/:question_line_id')).toEqual([]);
        });
    }

    test('when the lines can\'t be loaded again after saving, it says so', async ({ page, api }) => {
        showLines(api, MANAGER, []);
        api.json('POST statutory /events/:id/question-lines', ok(statutoryQuestionLine()));

        await page.goto('/statutory/agora-spring/question-lines');
        await expectEmptyTable(linesTable(page));
        api.on('GET statutory /events/:id/question-lines', { status: 500, json: { success: false, message: 'Internal server error.' } });
        await page.getByRole('button', { name: 'Create a question line' }).click();
        await dialog(page, 'Add question line').getByLabel('Name').fill('Budget');
        await dialog(page, 'Add question line').getByRole('button', { name: 'Save changes' }).click();

        await expect(toast(page, 'Question line is created.')).toBeVisible();
        await expect(toast(page, 'Could not load the question lines: Internal server error.')).toBeVisible();
    });

    test('a line is closed and opened again', async ({ page, api }) => {
        showLines(api);
        api.on('PUT statutory /events/:id/question-lines/:question_line_id/status', ({ body }) => ({ json: ok({ ...candidates(), ...(body as object), questions: undefined }) }));

        await page.goto('/statutory/agora-spring/question-lines');
        const status = page.getByRole('combobox', { name: 'Status of CD candidates' });
        await status.selectOption('Closed');
        await expect(toast(page, 'Successfully updated the status of question line "CD candidates" to closed.')).toBeVisible();
        await status.selectOption('Open');

        await expect(toast(page, 'Successfully updated the status of question line "CD candidates" to open.')).toBeVisible();
        expect(api.callsTo('PUT statutory /events/:id/question-lines/:question_line_id/status').map((call) => [call.params, call.body])).toEqual([
            [{ id: 'agora-spring', question_line_id: '4' }, { status: 'closed' }],
            [{ id: 'agora-spring', question_line_id: '4' }, { status: 'open' }]
        ]);
    });

    test('a refused status change says why and shows the stored status', async ({ page, api }) => {
        showLines(api);
        api.on('PUT statutory /events/:id/question-lines/:question_line_id/status', { status: 500, json: { success: false, message: 'Internal server error.' } });

        await page.goto('/statutory/agora-spring/question-lines');
        const status = page.getByRole('combobox', { name: 'Status of CD candidates' });
        await status.selectOption('Closed');

        await expect(toast(page, 'Could not update question line status: Internal server error.')).toBeVisible();
        await expect(status).toHaveValue('open');
    });

    test('deleting a question line asks first, and Cancel keeps it', async ({ page, api }) => {
        showLines(api);

        await page.goto('/statutory/agora-spring/question-lines');
        await lineRow(page, 'Elections').getByRole('button', { name: 'Delete' }).click();
        const confirm = dialog(page, 'Deleting a question line');
        await expect(confirm).toContainText('Are you sure you want to delete this question line? This action cannot be undone.');
        await confirm.getByRole('button', { name: 'Cancel' }).click();

        await expect(confirm).toHaveCount(0);
        await expect(tableRows(linesTable(page))).toHaveCount(3);
        expect(api.callsTo('DELETE statutory /events/:id/question-lines/:question_line_id')).toEqual([]);
    });

    test('deleting a line keeps the questions of the selected one in view', async ({ page, api }) => {
        showLines(api);
        api.json('DELETE statutory /events/:id/question-lines/:question_line_id', { success: true, message: 'The question line was deleted.' });

        await page.goto('/statutory/agora-spring/question-lines');
        await selectLine(page, 'CD candidates');
        await lineRow(page, 'Elections').getByRole('button', { name: 'Delete' }).click();
        await dialog(page, 'Deleting a question line').getByRole('button', { name: 'Delete question line' }).click();

        await expect(toast(page, 'Question line is deleted.')).toBeVisible();
        await expect(tableRows(linesTable(page))).toHaveCount(2);
        await expect(lineRow(page, 'Elections')).toHaveCount(0);
        await expect(tableRows(questionsOf(page, 'CD candidates').getByRole('table'))).toHaveCount(2);
        expect(api.callsTo('DELETE statutory /events/:id/question-lines/:question_line_id').map((call) => call.params))
            .toEqual([{ id: 'agora-spring', question_line_id: '5' }]);
    });

    test('deleting the selected line leaves no line selected', async ({ page, api }) => {
        showLines(api);
        api.json('DELETE statutory /events/:id/question-lines/:question_line_id', { success: true, message: 'The question line was deleted.' });

        await page.goto('/statutory/agora-spring/question-lines');
        await selectLine(page, 'CD candidates');
        await lineRow(page, 'CD candidates').getByRole('button', { name: 'Delete' }).click();
        await dialog(page, 'Deleting a question line').getByRole('button', { name: 'Delete question line' }).click();

        await expect(toast(page, 'Question line is deleted.')).toBeVisible();
        await expect(tableRows(linesTable(page))).toHaveCount(2);
        await expect(page.getByRole('region', { name: /^Questions of/ })).toHaveCount(0);
    });

    test('a question line that can\'t be deleted stays, and the reason is shown', async ({ page, api }) => {
        showLines(api);
        api.on('DELETE statutory /events/:id/question-lines/:question_line_id', { status: 500, json: { success: false, message: 'Internal server error.' } });

        await page.goto('/statutory/agora-spring/question-lines');
        await lineRow(page, 'Elections').getByRole('button', { name: 'Delete' }).click();
        await dialog(page, 'Deleting a question line').getByRole('button', { name: 'Delete question line' }).click();

        await expect(toast(page, 'Could not delete question line: Internal server error.')).toBeVisible();
        await expect(tableRows(linesTable(page))).toHaveCount(3);
    });

    test('an unknown event goes back to the list of statutory events', async ({ page, api }) => {
        api.fallback(mockEverything);
        api.on('GET statutory /events/:id', { status: 404, json: notFound('Event with such url or ID is not found.') });

        await page.goto('/statutory/nope/question-lines');

        await expect(toast(page, 'Event is not found')).toBeVisible();
        await expect(page).toHaveURL('/statutory');
    });

    test('who may not see the questions goes back to the list of statutory events', async ({ page, api }) => {
        api.fallback(mockEverything);
        api.json('GET statutory /events/:id', ok(statutoryEvent({ id: 5, url: 'agora-spring' })));
        api.on('GET statutory /events/:id/question-lines', { status: 403, json: forbidden('You are not allowed to see questions') });

        await page.goto('/statutory/agora-spring/question-lines');

        await expect(toast(page, 'Some error happened: You are not allowed to see questions')).toBeVisible();
        await expect(page).toHaveURL('/statutory');
    });
});

// Rules written for three past Agorae, kept with their pages (recognised by the event's URL).
test.describe('question lines of the Agorae of 2022 to 2024', () => {
    for (const [url, rule] of [
        ['spring-agora-novi-sad-2022', 'In case you are a visitor, your submitted question line place request will be considered as a request for speaking rights as well.'],
        ['spring-agora-enschede-2023', 'Online question lines will be used only for candidates.'],
        ['spring-agora-novi-sad-2024', 'B - one yes or no question to few candidates']
    ] as const) {
        test(`the question lines of ${url} show its rules`, async ({ page, api }) => {
            api.json('GET statutory /events/:id', ok(statutoryEvent({ id: 5, url, permissions: PARTICIPANT })));
            answerLines(api, [activities()]);
            await page.goto(`/statutory/${url}/question-lines`);

            await expect(page.getByText(rule)).toBeVisible();
        });
    }

    test('asking a question at the Agora of Novi Sad 2022 shows its letters', async ({ page, api }) => {
        api.json('GET statutory /events/:id', ok(statutoryEvent({ id: 5, url: 'spring-agora-novi-sad-2022', permissions: PARTICIPANT })));
        answerLines(api, [activities()]);
        await page.goto('/statutory/spring-agora-novi-sad-2022/question-lines');

        await lineRow(page, 'Activity plan').getByRole('button', { name: 'Ask a question!' }).click();

        await expect(dialog(page, 'Ask a question')).toContainText('3 - a yes or no question to more candidates');
    });

    test('other Agorae have no such rules', async ({ page, api }) => {
        showLines(api, PARTICIPANT, [activities()]);
        await page.goto('/statutory/agora-spring/question-lines');

        await expect(tableRows(linesTable(page))).toHaveCount(1);
        await expect(page.getByText('Online question lines will be used only for candidates.')).toHaveCount(0);
        await expect(page.getByText(/speaking rights/)).toHaveCount(0);
    });
});
