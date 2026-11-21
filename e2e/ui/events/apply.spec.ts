// Applying to an event (/events/:id/applications/me): the form built from the event's questions,
// editing while applications are open, and what's shown once they're closed.
// Runs against Vue and React (@migrated).
import { test, expect, toast } from '../support/test.ts';
import type { ApiMock } from '../support/api-mock.ts';
import {
    application, body, event, eventPermissions, iso, notFound, ok, question, validationError,
    type Application, type Event
} from '../support/factories.ts';

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
        : { status: 404, json: notFound('Event is not found') }));
    api.on('GET events /single/:id/applications/:application_id', existing
        ? { json: ok(existing) }
        : { status: 404, json: notFound('Application with id me not found') });
};

test.describe('applying to an event', { tag: '@migrated' }, () => {
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
        mockEvent(api, event({ url: 'spring', questions: [] }));
        api.on('POST events /single/:id/applications', {
            status: 422,
            json: validationError({ answers: ['Answer number 1 ("Motivation") is too short.'], body_id: ['You are not a member of this body.'] })
        });
        await page.goto('/events/spring/applications/me');

        await page.getByRole('checkbox', { name: PRIVACY }).check();
        await page.getByRole('button', { name: 'Save application!' }).click();

        await expect(toast(page, 'Some of the application data is invalid.')).toBeVisible();
        await expect(page.getByText('Could not apply because of these reasons:')).toBeVisible();
        await expect(page.getByRole('listitem').filter({ hasText: 'Answer number 1 ("Motivation") is too short.' })).toBeVisible();
        await expect(page.getByRole('listitem').filter({ hasText: 'You are not a member of this body.' })).toBeVisible();
        await expect(page).toHaveURL('/events/spring/applications/me');
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
            await expect(page.getByRole('row', { name: /Why do you want to join\?/ }).getByRole('cell').last()).toHaveText('Because');
            await expect(page.getByRole('row', { name: /I am vegetarian/ }).getByRole('cell').last()).toHaveText('No');
            await expect(page.getByRole('row', { name: /T-shirt size/ }).getByRole('cell').last()).toHaveText('L');
            await expect(page.getByRole('row', { name: PRIVACY }).getByRole('cell').last()).toHaveText('Yes');
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

    test('an unknown event goes back to the events list', async ({ page, api, frontend }) => {
        // Vue pushes to a route name that doesn't exist (`oms.events.list`), which leaves the
        // browser on `/`. The React app goes to the list, which is what the code meant to do.
        // UI_SHOW_KNOWN_BUGS=1 runs it as a normal test to see the failure.
        test.fail(frontend === 'vue' && !process.env.UI_SHOW_KNOWN_BUGS, 'Known Vue bug: views/events/Apply.vue redirects to the unknown route oms.events.list');
        api.on('GET events /single/:id', { status: 404, json: notFound('Event is not found') });
        api.json('GET events /', ok([]));

        await page.goto('/events/nope/applications/me');

        await expect(toast(page, 'Event is not found')).toBeVisible();
        await expect(page).toHaveURL('/events');
    });
});
