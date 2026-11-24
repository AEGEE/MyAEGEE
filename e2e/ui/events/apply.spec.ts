// Applying to an event (/events/:id/applications/me): the form built from the event's questions,
// editing while applications are open, and what's shown once they're closed.
import type { ApiMock } from '../support/api-mock.ts';
import { badRequest, forbidden, iso, notFound, ok, validationError } from '../support/factories/base.ts';
import { body } from '../support/factories/core.ts';
import { application, event, eventPermissions, question, type Application, type Event } from '../support/factories/events.ts';
import { cellOf, openAccountMenu, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const QUESTIONS = [
    question({ type: 'string', description: 'Why do you want to join?', required: true }),
    question({ type: 'text', description: 'Tell us about yourself' }),
    question({ type: 'number', description: 'How many events did you attend?' }),
    question({ type: 'checkbox', description: 'I am vegetarian' }),
    question({ type: 'select', description: 'T-shirt size', required: true, values: ['S', 'M', 'L'] })
];

const PRIVACY = /I agree with my personal data to be processed/;

// Serves the event and the member's application (none when `existing` is null).
const mockEvent = (api: ApiMock, data: Event, existing: Application | null = null) => {
    api.on('GET events /single/:id', ({ params }) => (params.id === data.url
        ? { json: ok(data, { permissions: eventPermissions() }) }
        : { status: 404, json: notFound(`Event with id ${params.id} not found`) }));
    api.on('GET events /single/:id/applications/:application_id', existing
        ? { json: ok(existing) }
        : { status: 404, json: notFound('Application with id me not found') });
};

test.describe('applying to an event', () => {
    test.beforeEach(({ me }) => {
        // Two bodies; the primary one comes first in the list even though it sorts last.
        me!.bodies = [body({ id: 1, name: 'AEGEE-Alpha' }), body({ id: 2, name: 'AEGEE-Zulu' })];
        me!.primary_body_id = 2;
    });

    test('a member fills in the questions and applies', async ({ page, api }) => {
        mockEvent(api, event({ id: 5, url: 'spring', name: 'Spring Training', questions: QUESTIONS }));
        api.on('POST events /single/:id/applications', ({ body: sent }) => ({ json: ok(application({ ...(sent as object), id: 77 })) }));

        await page.goto('/events/spring/applications/me');

        await expect(page.getByRole('heading', { name: 'Apply to Spring Training' })).toBeVisible();
        await expect(page).toHaveTitle('MyAEGEE | View/edit the event application');

        const bodySelect = page.getByRole('combobox', { name: /^Body/ });
        await expect(bodySelect.getByRole('option')).toHaveText(['AEGEE-Zulu', 'AEGEE-Alpha']);
        await expect(bodySelect).toHaveValue(/2/);

        // Answers start empty, at 0, unchecked and at the first option.
        await expect(page.getByRole('textbox', { name: /Why do you want to join\?/ })).toHaveValue('');
        await expect(page.getByRole('spinbutton', { name: /How many events did you attend\?/ })).toHaveValue('0');
        await expect(page.getByRole('checkbox', { name: /I am vegetarian/ })).not.toBeChecked();
        await expect(page.getByRole('combobox', { name: /T-shirt size/ })).toHaveValue('S');

        await bodySelect.selectOption({ label: 'AEGEE-Alpha' });
        await page.getByRole('textbox', { name: /Why do you want to join\?/ }).fill('To learn');
        await page.getByRole('textbox', { name: /Tell us about yourself/ }).fill('I like events');
        await page.getByRole('spinbutton', { name: /How many events did you attend\?/ }).fill('3');
        await page.getByRole('checkbox', { name: /I am vegetarian/ }).check();
        await page.getByRole('combobox', { name: /T-shirt size/ }).selectOption('M');
        await page.getByRole('checkbox', { name: PRIVACY }).check();
        await page.getByRole('button', { name: 'Save application!' }).click();

        await expect(toast(page, 'Your application was saved, you can still edit it until the application period ends')).toBeVisible();
        await expect(page).toHaveURL('/events/spring');
        expect(api.callsTo('POST events /single/:id/applications').map((call) => [call.params.id, call.body])).toEqual([[
            'spring',
            { body_id: 1, answers: ['To learn', 'I like events', 3, true, 'M'], agreed_to_privacy_policy: true }
        ]]);
    });

    test('the browser checks required answers and the privacy consent before sending', async ({ page, api }) => {
        mockEvent(api, event({ url: 'spring', questions: QUESTIONS }));
        await page.goto('/events/spring/applications/me');

        await page.getByRole('button', { name: 'Save application!' }).click();

        const required = page.getByRole('textbox', { name: /Why do you want to join\?/ });
        expect(await required.evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
        await required.fill('To learn');
        await page.getByRole('button', { name: 'Save application!' }).click();
        expect(await page.getByRole('checkbox', { name: PRIVACY }).evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);

        expect(api.callsTo('POST events /single/:id/applications')).toHaveLength(0);
    });

    test('shows why the service refused the application', async ({ page, api }) => {
        mockEvent(api, event({ url: 'spring', questions: [question({ type: 'number', description: 'How many events did you attend?' })] }));
        api.on('POST events /single/:id/applications', {
            status: 422,
            json: validationError({ answers: ['Answer number 1 ("How many events did you attend?") should be a number, but got "".'] })
        });
        await page.goto('/events/spring/applications/me');

        // An emptied number field is sent as an empty text, which the service refuses.
        await page.getByRole('spinbutton', { name: /How many events did you attend\?/ }).fill('');
        await page.getByRole('checkbox', { name: PRIVACY }).check();
        await page.getByRole('button', { name: 'Save application!' }).click();

        await expect(toast(page, 'Some of the application data is invalid.')).toBeVisible();
        await expect(page.getByText('Could not apply because of these reasons:')).toBeVisible();
        await expect(page.getByRole('listitem').filter({ hasText: 'Answer number 1 ("How many events did you attend?") should be a number, but got "".' })).toBeVisible();
        await expect(page).toHaveURL('/events/spring/applications/me');
        expect(api.callsTo('POST events /single/:id/applications').map((call) => call.body)).toEqual([{ body_id: 2, answers: [''], agreed_to_privacy_policy: true }]);
    });

    test('a body the service refuses shows under the body select', async ({ page, api }) => {
        mockEvent(api, event({ url: 'spring', questions: [] }), application({ id: 77, body_id: 1, answers: [] }));
        api.on('PUT events /single/:id/applications/:application_id', { status: 422, json: validationError({ body_id: ['Body ID should be a number.'] }) });
        await page.goto('/events/spring/applications/me');

        await page.getByRole('button', { name: 'Save application!' }).click();

        await expect(toast(page, 'Some of the application data is invalid.')).toBeVisible();
        await expect(page.getByRole('listitem').filter({ hasText: 'Body ID should be a number.' })).toBeVisible();
        expect(api.callsTo('PUT events /single/:id/applications/:application_id').map((call) => call.body)).toEqual([{ body_id: 1, answers: [], agreed_to_privacy_policy: true }]);
    });

    test('an existing application can be changed while applications are open', async ({ page, api }) => {
        mockEvent(
            api,
            event({ url: 'spring', name: 'Spring Training', questions: QUESTIONS }),
            application({ id: 77, body_id: 1, answers: ['Because', 'Me', 2, true, 'L'], agreed_to_privacy_policy: true })
        );
        api.on('PUT events /single/:id/applications/:application_id', ({ body: sent }) => ({ json: ok(application({ ...(sent as object), id: 77 })) }));

        await page.goto('/events/spring/applications/me');

        await expect(page.getByRole('heading', { name: 'Edit your application on Spring Training' })).toBeVisible();
        await expect(page.getByRole('combobox', { name: /^Body/ })).toHaveValue(/1/);
        await expect(page.getByRole('textbox', { name: /Why do you want to join\?/ })).toHaveValue('Because');
        await expect(page.getByRole('spinbutton', { name: /How many events did you attend\?/ })).toHaveValue('2');
        await expect(page.getByRole('checkbox', { name: /I am vegetarian/ })).toBeChecked();
        await expect(page.getByRole('combobox', { name: /T-shirt size/ })).toHaveValue('L');
        await expect(page.getByRole('checkbox', { name: PRIVACY })).toBeChecked();

        await page.getByRole('textbox', { name: /Why do you want to join\?/ }).fill('Because I want to');
        await page.getByRole('button', { name: 'Save application!' }).click();

        await expect(page).toHaveURL('/events/spring');
        expect(api.callsTo('PUT events /single/:id/applications/:application_id').map((call) => [call.params.application_id, call.body])).toEqual([[
            'me',
            { body_id: 1, answers: ['Because I want to', 'Me', 2, true, 'L'], agreed_to_privacy_policy: true }
        ]]);
    });

    test('after saving, coming back to the form shows the saved answers', async ({ page, api }) => {
        // The page must ask again, not show a remembered "no application yet".
        const data = event({ id: 5, url: 'spring', name: 'Spring Training', questions: [QUESTIONS[0]] });
        let saved: Application | null = null;
        api.on('GET events /single/:id', { json: ok(data, { permissions: eventPermissions() }) });
        api.on('GET events /single/:id/applications/:application_id', () => (saved
            ? { json: ok(saved) }
            : { status: 404, json: notFound('Application with id me not found') }));
        api.on('POST events /single/:id/applications', ({ body: sent }) => {
            saved = application({ ...(sent as object), id: 77 });
            return { json: ok(saved) };
        });

        await page.goto('/events/spring/applications/me');
        await page.getByRole('textbox', { name: /Why do you want to join\?/ }).fill('To learn');
        await page.getByRole('checkbox', { name: PRIVACY }).check();
        await page.getByRole('button', { name: 'Save application!' }).click();
        await expect(page).toHaveURL('/events/spring');

        await page.getByRole('link', { name: 'Manage my application' }).click();

        await expect(page.getByRole('heading', { name: 'Edit your application on Spring Training' })).toBeVisible();
        await expect(page.getByRole('textbox', { name: /Why do you want to join\?/ })).toHaveValue('To learn');
    });

    for (const [status, message] of [
        ['pending', 'Your application is being processed, please wait for the organisers to evaluate your application. Unfortunately you can not edit it anymore.'],
        ['accepted', 'Congratulations, you have been accepted to the event!'],
        ['rejected', 'Sorry, but you were not accepted to the event.']
    ] as const) {
        test(`after the deadline a ${status} application is shown read-only`, async ({ page, api }) => {
            mockEvent(
                api,
                event({ url: 'spring', name: 'Spring Training', application_status: 'closed', application_ends: iso(-1), questions: QUESTIONS }),
                application({ body_id: 2, status, answers: ['Because', '', 2, false, 'L'], agreed_to_privacy_policy: true })
            );

            await page.goto('/events/spring/applications/me');

            await expect(page.getByRole('heading', { name: 'See your application on Spring Training' })).toBeVisible();
            await expect(page.getByRole('link', { name: 'AEGEE-Zulu' })).toHaveAttribute('href', '/bodies/2');
            const answers = page.getByRole('table');
            const answer = async (asked: RegExp) => {
                const row = answers.getByRole('row', { name: asked });
                await expect(row).toBeVisible();
                return cellOf(answers, row, 'Your answer');
            };
            await expect(await answer(/Why do you want to join\?/)).toHaveText('Because');
            await expect(await answer(/I am vegetarian/)).toHaveText('No');
            await expect(await answer(/T-shirt size/)).toHaveText('L');
            await expect(await answer(PRIVACY)).toHaveText('Yes');
            await expect(page.getByText(message)).toBeVisible();
            await expect(page.getByRole('button', { name: 'Save application!' })).toBeHidden();
        });
    }

    test('without an application, a closed event cannot be applied to', async ({ page, api }) => {
        mockEvent(api, event({ url: 'spring', application_status: 'closed', application_ends: iso(-1), questions: QUESTIONS }));

        await page.goto('/events/spring/applications/me');

        await expect(page.getByText('You cannot apply: the applications are closed or the event is not published yet.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Save application!' })).toBeHidden();
    });

    test('events without applications need none', async ({ page, api }) => {
        mockEvent(api, event({ url: 'open-day', has_applications: false }));

        await page.goto('/events/open-day/applications/me');

        await expect(page.getByText('This event does not accept any applications, you can join without applying.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Save application!' })).toHaveCount(0);
    });

    test('a member with an application ban cannot apply', async ({ page, api, me }) => {
        me!.event_application_ban = { ban_until: '2099-01-01T10:00:00.000Z' };
        mockEvent(api, event({ url: 'spring', questions: QUESTIONS }));

        await page.goto('/events/spring/applications/me');

        await expect(page.getByText('You are temporarily banned from submitting new event applications until 2099-01-01 11:00.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Save application!' })).toBeHidden();
    });

    test('an unknown event goes back to the events list', async ({ page, api }) => {
        api.on('GET events /single/:id', { status: 404, json: notFound('Event with id nope not found') });
        api.json('GET events /', ok([]));

        await page.goto('/events/nope/applications/me');

        await expect(toast(page, 'Event is not found')).toBeVisible();
        await expect(page).toHaveURL('/events');
    });
    test('a consent error from the service shows under the checkbox', async ({ page, api }) => {
        mockEvent(api, event({ url: 'spring', questions: [] }));
        api.on('POST events /single/:id/applications', { status: 422, json: validationError({ agreed_to_privacy_policy: ['You should agree to Privacy Policy.'] }) });
        await page.goto('/events/spring/applications/me');

        await page.getByRole('checkbox', { name: PRIVACY }).check();
        await page.getByRole('button', { name: 'Save application!' }).click();

        await expect(toast(page, 'Some of the application data is invalid.')).toBeVisible();
        await expect(page.getByText('You should agree to Privacy Policy.', { exact: true })).toBeVisible();
        await expect(page.getByText('Could not apply because of these reasons:')).toHaveCount(0);
    });

    test('other save errors show the message and stay on the form', async ({ page, api }) => {
        mockEvent(api, event({ url: 'spring', questions: [] }));
        api.on('POST events /single/:id/applications', { status: 400, json: badRequest('You are not a member of this body.') });
        await page.goto('/events/spring/applications/me');

        await page.getByRole('checkbox', { name: PRIVACY }).check();
        await page.getByRole('button', { name: 'Save application!' }).click();

        await expect(toast(page, 'Could not save application: You are not a member of this body.')).toBeVisible();
        await expect(page).toHaveURL('/events/spring/applications/me');
        await expect(page.getByRole('button', { name: 'Save application!' })).toBeVisible();
    });

    test('a banned member can still change an existing application', async ({ page, api, me }) => {
        me!.event_application_ban = { ban_until: '2099-01-01T10:00:00.000Z' };
        mockEvent(api, event({ url: 'spring', name: 'Spring Training', questions: [QUESTIONS[0]] }), application({ id: 77, body_id: 2, answers: ['Because'] }));
        api.on('PUT events /single/:id/applications/:application_id', ({ body: sent }) => ({ json: ok(application({ ...(sent as object), id: 77 })) }));
        await page.goto('/events/spring/applications/me');

        await expect(page.getByRole('heading', { name: 'Edit your application on Spring Training' })).toBeVisible();
        await expect(page.getByText(/You are temporarily banned/)).toHaveCount(0);
        await page.getByRole('textbox', { name: /Why do you want to join\?/ }).fill('Because I can');
        await page.getByRole('button', { name: 'Save application!' }).click();

        await expect(page).toHaveURL('/events/spring');
        expect(api.callsTo('PUT events /single/:id/applications/:application_id').map((call) => call.body))
            .toEqual([{ body_id: 2, answers: ['Because I can'], agreed_to_privacy_policy: true }]);
    });

    test('an event that is not published yet can\'t be applied to', async ({ page, api }) => {
        mockEvent(api, event({ url: 'spring', status: 'submitted', application_status: 'open', questions: QUESTIONS }));
        await page.goto('/events/spring/applications/me');

        await expect(page.getByText('You cannot apply: the applications are closed or the event is not published yet.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Save application!' })).toBeHidden();
    });

    test('the read-only view names the body of the application, also one the member has left', async ({ page, api }) => {
        mockEvent(
            api,
            event({ url: 'spring', application_status: 'closed', application_ends: iso(-1), questions: [] }),
            application({ body_id: 3, body_name: 'AEGEE-Left', status: 'pending' })
        );
        await page.goto('/events/spring/applications/me');

        await expect(page.getByRole('link', { name: 'AEGEE-Left' })).toHaveAttribute('href', '/bodies/3');
    });

    test('the read-only view says no answers were needed when there are no questions', async ({ page, api }) => {
        mockEvent(api, event({ url: 'spring', application_status: 'closed', application_ends: iso(-1), questions: [] }), application({ body_id: 2, status: 'accepted' }));
        await page.goto('/events/spring/applications/me');

        await expect(page.getByText('You didn\'t need to fill in the application fields.')).toBeVisible();
    });

    test('the read-only view marks only the required questions with "*"', async ({ page, api }) => {
        mockEvent(
            api,
            event({ url: 'spring', application_status: 'closed', application_ends: iso(-1), questions: [QUESTIONS[0], QUESTIONS[1]] }),
            application({ body_id: 2, answers: ['Because', 'Me'] })
        );
        await page.goto('/events/spring/applications/me');

        const answers = page.getByRole('table');
        await expect(answers.getByRole('row', { name: /Why do you want to join\?/ }).getByRole('cell').filter({ hasText: 'Why' })).toHaveText('Why do you want to join?*');
        await expect(answers.getByRole('row', { name: /Tell us about yourself/ }).getByRole('cell').filter({ hasText: 'Tell us' })).toHaveText('Tell us about yourself');
    });

    test('an error loading the application goes back to the list', async ({ page, api }) => {
        api.json('GET events /single/:id', ok(event({ url: 'spring' }), { permissions: eventPermissions() }));
        api.on('GET events /single/:id/applications/:application_id', { abort: 'failed' });
        api.json('GET events /', ok([]));
        await page.goto('/events/spring/applications/me');

        await expect(toast(page, 'Some error happened: Network Error')).toBeVisible();
        await expect(page).toHaveURL('/events');
    });

    test('an error loading the event goes back to the list with the message', async ({ page, api }) => {
        api.on('GET events /single/:id', { status: 403, json: forbidden('You cannot see this event.') });
        api.json('GET events /', ok([]));
        await page.goto('/events/spring/applications/me');

        await expect(toast(page, 'Some error happened: You cannot see this event.')).toBeVisible();
        await expect(page).toHaveURL('/events');
    });
    // Members without a body are sent to complete their profile first; only a superadmin gets
    // to the form without one.
    test.describe('as a superadmin without bodies', () => {
        test.use({ session: 'superadmin' });

        test('someone without bodies is told to join one and can\'t save', async ({ page, api, me }) => {
            me!.bodies = [];
            me!.primary_body_id = null;
            mockEvent(api, event({ url: 'spring', questions: [] }));
            await page.goto('/events/spring/applications/me');

            await expect(page.getByText('You are not a member of any body, therefore you cannot apply.')).toBeVisible();
            await expect(page.getByRole('combobox', { name: /^Body/ })).toBeHidden();

            await page.getByRole('checkbox', { name: PRIVACY }).check();
            await page.getByRole('button', { name: 'Save application!' }).click();

            await expect(toast(page, 'Please select a body.')).toBeVisible();
            expect(api.callsTo('POST events /single/:id/applications')).toHaveLength(0);
        });
    });
    test('after applying to an event without a URL, its page opens by its id', async ({ page, api }) => {
        api.on('GET events /single/:id', { json: ok(event({ id: 5, url: '', name: 'No Url', questions: [] }), { permissions: eventPermissions() }) });
        api.on('GET events /single/:id/applications/:application_id', { status: 404, json: notFound('Application with id me not found') });
        api.on('POST events /single/:id/applications', ({ body: sent }) => ({ json: ok(application({ ...(sent as object), id: 77 })) }));
        await page.goto('/events/5/applications/me');

        await page.getByRole('checkbox', { name: PRIVACY }).check();
        await page.getByRole('button', { name: 'Save application!' }).click();

        await expect(page).toHaveURL('/events/5');
        await expect(page.getByRole('heading', { name: 'No Url', level: 1 })).toBeVisible();
        expect(api.callsTo('POST events /single/:id/applications').map((call) => call.params.id)).toEqual(['5']);
    });

    test.describe('logging out', () => {
        test('logging out on the application form goes to the login page without errors', async ({ page, api, layout }) => {
            mockEvent(api, event({ url: 'spring', questions: QUESTIONS }));
            await page.goto('/events/spring/applications/me');
            await expect(page.getByRole('button', { name: 'Save application!' })).toBeVisible();

            await (await openAccountMenu(page, layout)).getByRole('button', { name: 'Logout' }).click();

            await expect(page).toHaveURL(/\/login/);
            expect(api.callsTo('POST core /logout')).toHaveLength(1);
        });
    });
});
