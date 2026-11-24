// The board's part in an application, against the real services: a member applies to an event,
// the board of the member's antenna (approve_members:events for that body, which core's
// POST /my_permissions gives the board view) sees the application and comments on it, and the
// organiser sees the comment in the application and accepts it.
// The details of these pages are covered by the mocked-API suite in ui/events/.
import type { Envelope } from '../support/api.ts';
import { test, expect, loginInBrowser } from '../support/api.ts';

test.describe('the board view of events', () => {
    test('the board comments on a member\'s application, and the organiser reads it and accepts', async ({ api, page }) => {
        const name = `Board flow ${Date.now()}`;
        const event = await api.createEvent('admin', { name, type: 'training' });
        await api.publishAsAdmin(event.id);
        const applicant = await api.me('member');
        const application = await api.apply('member', event.id);

        await loginInBrowser(page, api, 'board');
        await page.goto('/events/boardview');
        await expect(page.getByText(`You are currently viewing applications from ${applicant.bodies[0].name}.`)).toBeVisible();
        const row = page.getByRole('row').filter({ has: page.getByRole('link', { name }) });
        await row.getByRole('textbox', { name: `Board comment for ${applicant.first_name} ${applicant.last_name}` }).fill('Active in the local');
        await row.getByRole('button', { name: 'Save' }).click();
        await expect(page.getByRole('alert').or(page.getByRole('status')).filter({ hasText: 'Participant comment is updated.' })).toBeVisible();

        // The organiser (admin created the event) sees the comment and accepts the application.
        await loginInBrowser(page, api, 'admin');
        await page.goto(`/events/${event.url}/participants`);
        const participant = page.getByRole('row').filter({ hasText: `${applicant.first_name} ${applicant.last_name}` });
        await participant.getByRole('button', { name: `View the application of ${applicant.first_name} ${applicant.last_name}` }).click();
        await expect(page.getByRole('dialog', { name: 'View participant' }).getByRole('row', { name: /^Board comment/ })).toContainText('Active in the local');
        await page.getByRole('dialog', { name: 'View participant' }).getByRole('button', { name: 'close' }).click();

        await participant.getByRole('combobox', { name: `Status of ${applicant.first_name} ${applicant.last_name}` }).selectOption({ label: 'Accepted' });
        await expect(page.getByRole('alert').or(page.getByRole('status')).filter({ hasText: `Successfully updated status of application for user #${applicant.id} to "accepted"` })).toBeVisible();

        const stored = await api.call<Envelope<{ status: string; board_comment: string }>>('admin', 'GET', `/api/events/single/${event.id}/applications/${application.id}`);
        expect(stored.body.data).toMatchObject({ status: 'accepted', board_comment: 'Active in the local' });
    });
});
