// The events flow end to end against the real services: a member finds a published event,
// applies with answers to its questions, and the organiser's side (events) has the application.
// Runs against the Vue app, or with E2E_FRONTEND=react against the React app for the migrated
// pages (see support/frontend-routing.ts). The detailed UI behaviour is in ui/events/*.
import type { Envelope } from '../support/api.ts';
import { test, expect, loginInBrowser } from '../support/api.ts';

test.describe('applying to an event', () => {
    test('a member finds a published event, applies, and can still change the application', async ({ api, page }) => {
        const name = `Apply flow ${Date.now()}`;
        const event = await api.createEvent('admin', {
            name,
            type: 'training',
            questions: [
                { type: 'string', description: 'Why do you want to join?', required: true },
                { type: 'select', description: 'T-shirt size', required: true, values: ['S', 'M', 'L'] }
            ]
        });
        await api.publishAsAdmin(event.id);
        const member = await api.me('member');

        await loginInBrowser(page, api, 'member');
        await page.goto('/events');
        await page.getByRole('textbox', { name: 'Search by name or description' }).fill(name);
        const card = page.getByRole('article', { name });
        await card.getByRole('link', { name: 'Apply!' }).click();

        await expect(page.getByRole('heading', { name: `Apply to ${name}` })).toBeVisible();
        await page.getByRole('textbox', { name: /Why do you want to join\?/ }).fill('To learn things');
        await page.getByRole('combobox', { name: /T-shirt size/ }).selectOption('M');
        await page.getByRole('checkbox', { name: /I agree with my personal data to be processed/ }).check();
        await page.getByRole('button', { name: 'Save application!' }).click();

        await expect(page).toHaveURL(`/events/${event.url}`);
        const saved = await api.call<Envelope<{ body_id: number; answers: unknown[]; status: string }>>('member', 'GET', `/api/events/single/${event.id}/applications/me`);
        expect(saved.status).toBe(200);
        expect(saved.body.data).toMatchObject({ body_id: member.bodies[0].id, answers: ['To learn things', 'M'], status: 'pending' });

        // Applications are open, so it can still be changed.
        await page.getByRole('link', { name: 'Manage my application' }).click();
        await expect(page.getByRole('heading', { name: `Edit your application on ${name}` })).toBeVisible();
        await expect(page.getByRole('textbox', { name: /Why do you want to join\?/ })).toHaveValue('To learn things');
        await page.getByRole('combobox', { name: /T-shirt size/ }).selectOption('L');
        await page.getByRole('button', { name: 'Save application!' }).click();
        await expect(page).toHaveURL(`/events/${event.url}`);

        const changed = await api.call<Envelope<{ answers: unknown[] }>>('member', 'GET', `/api/events/single/${event.id}/applications/me`);
        expect(changed.body.data.answers).toEqual(['To learn things', 'L']);
    });

    test('the service\'s validation errors are shown on the form', async ({ api, page }) => {
        // A required question the browser can't check: a number is never "missing".
        const event = await api.createEvent('admin', { questions: [{ type: 'number', description: 'How old are you?', required: true }] });
        await api.publishAsAdmin(event.id);

        await loginInBrowser(page, api, 'member');
        await page.goto(`/events/${event.url}/applications/me`);
        await page.getByRole('spinbutton', { name: /How old are you\?/ }).fill('');
        await page.getByRole('checkbox', { name: /I agree with my personal data to be processed/ }).check();
        await page.getByRole('button', { name: 'Save application!' }).click();

        await expect(page.getByText('Could not apply because of these reasons:')).toBeVisible();
        await expect(page).toHaveURL(`/events/${event.url}/applications/me`);
    });
});
