const { QuestionLine, Question } = require('../../models');

// The validation messages of an instance, per field; an empty object when it is valid.
const errorsOf = async (instance) => {
    try {
        await instance.validate();
        return {};
    } catch (err) {
        return err.errors.reduce((acc, error) => {
            acc[error.path] = [...(acc[error.path] || []), error.message];
            return acc;
        }, {});
    }
};

// The rules of the models that no request reaches: the routes fill in the event of a question
// line, and the question line and the application of a question, themselves.
describe('QuestionLine model', () => {
    test('refuses a question line without an event', async () => {
        expect(await errorsOf(QuestionLine.build({ name: 'Questions to the board' }))).toEqual({
            event_id: ['Event should be set.', 'Event ID should be a number.']
        });
    });

    test('refuses an event that is not a number', async () => {
        const errors = await errorsOf(QuestionLine.build({ name: 'Questions to the board', event_id: 'abc' }));

        expect(errors.event_id).toContain('Event ID should be a number.');
    });

    test('opens a new question line', async () => {
        const questionLine = QuestionLine.build({ name: 'Questions to the board', event_id: 1 });

        expect(questionLine.status).toEqual('open');
        expect(await errorsOf(questionLine)).toEqual({});
    });
});

describe('Question model', () => {
    test('refuses a question without a question line and an application', async () => {
        expect(await errorsOf(Question.build({ text: 'What about the budget?' }))).toEqual({
            question_line_id: ['Question line should be set.', 'Question line ID should be a number.'],
            application_id: ['Application should be set.', 'Application ID should be a number.']
        });
    });

    test('refuses a question line and an application that are not numbers', async () => {
        const errors = await errorsOf(Question.build({
            text: 'What about the budget?', question_line_id: 'abc', application_id: 'abc'
        }));

        expect(errors.question_line_id).toContain('Question line ID should be a number.');
        expect(errors.application_id).toContain('Application ID should be a number.');
    });

    test('accepts a question with a text, a question line and an application', async () => {
        const question = Question.build({ text: 'What about the budget?', question_line_id: 1, application_id: 1 });

        expect(await errorsOf(question)).toEqual({});
    });
});
