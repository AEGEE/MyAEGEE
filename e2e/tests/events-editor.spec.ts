// An event's way from the editor to the events list, against the real services: a member
// creates an in-person event (its body from core's bodies, a co-organiser found through core's
// member search), asks for approval on the event page, the approval team publishes it on the
// status page, and members find it in the list. The organisers get their mails.
// The details of these pages are covered by the mocked-API suite in ui/events/.
import type { Page } from '@playwright/test';

import type { Envelope } from '../support/api.ts';
import { test, expect, loginInBrowser } from '../support/api.ts';

const DAY = 24 * 60 * 60 * 1000;

// A day from now in the editor's format, at a fixed time of day.
const day = (offset: number, time: string): string => `${new Date(Date.now() + offset * DAY).toISOString().slice(0, 10)} ${time}`;

const fillDate = async (page: Page, label: RegExp, value: string): Promise<void> => {
    const input = page.getByLabel(label);
    await input.fill(value);
    await input.press('Enter');
};

test.describe('creating and publishing an event', () => {
    test('a member creates an event, asks for approval, and it is published and listed', async ({ api, page }) => {
        const member = await api.me('member');
        const coOrganiser = await api.me('board');
        const name = `Editor flow ${Date.now()}`;

        await loginInBrowser(page, api, 'member');
        await page.goto('/events/new');
        await page.getByRole('textbox', { name: /^Title/ }).fill(name);
        await page.getByRole('textbox', { name: /^Description/ }).fill('Created in the editor by the e2e tests.');
        await page.getByRole('combobox', { name: /^Event type/ }).selectOption({ label: 'Training Event' });
        await page.getByRole('spinbutton', { name: /^Fee/ }).fill('20');
        await page.getByRole('spinbutton', { name: /^Number of meals provided per day/ }).fill('2');
        await page.getByRole('textbox', { name: /^Accommodation type/ }).fill('Hostel');
        await fillDate(page, /^Application period starts/, day(-1, '10:00'));
        await fillDate(page, /^Application period ends/, day(10, '10:00'));
        await fillDate(page, /^Event start date/, day(20, '10:00'));
        await fillDate(page, /^Event end date/, day(22, '16:00'));
        await page.getByRole('combobox', { name: 'Add organising body' }).selectOption({ label: member.bodies[0].name });
        await page.getByRole('button', { name: 'Add', exact: true }).click();

        await page.getByRole('textbox', { name: 'Add organiser' }).fill(coOrganiser.last_name);
        await page.getByRole('main').getByRole('button', { name: new RegExp(`${coOrganiser.first_name}\\s+${coOrganiser.last_name}`) }).click();
        await page.getByRole('textbox', { name: `Comment for ${coOrganiser.first_name} ${coOrganiser.last_name}` }).fill('Treasurer');
        await page.getByRole('textbox', { name: 'Link to event budget' }).fill('https://example.org/budget');
        await page.getByRole('textbox', { name: 'Link to event program' }).fill('https://example.org/programme');
        await page.getByRole('button', { name: 'Save event' }).click();

        await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
        const url = new URL(page.url()).pathname.split('/').pop()!;
        const stored = await api.call<Envelope<{ id: number; organizers: { user_id: number; comment?: string }[]; organizing_bodies: { body_id: number }[]; status: string }>>('member', 'GET', `/api/events/single/${url}`);
        expect(stored.status).toBe(200);
        expect(stored.body.data.status).toBe('draft');
        expect(stored.body.data.organizing_bodies.map((item) => item.body_id)).toEqual([member.bodies[0].id]);
        expect(stored.body.data.organizers).toEqual(expect.arrayContaining([
            expect.objectContaining({ user_id: member.id, comment: 'Event creator.' }),
            expect.objectContaining({ user_id: coOrganiser.id, comment: 'Treasurer' })
        ]));
        await api.waitForMail({ to: member.email, template: 'events_event_created.html' });

        // The organiser asks for approval on the event page.
        await page.getByRole('button', { name: 'Ask for approval' }).click();
        await page.getByRole('alertdialog', { name: 'Change status' }).getByRole('button', { name: 'Change status' }).click();
        await expect(page.getByText('This event is under approval. Wait a little till EQAC approves it.')).toBeVisible();
        await api.waitForMail({ to: 'events-approval@aegee.eu', template: 'events_submitted.html' });

        // The approval team publishes it on the status page.
        await loginInBrowser(page, api, 'admin');
        await page.goto('/events/change_status');
        const row = page.getByRole('row').filter({ hasText: name });
        await row.getByRole('button', { name: 'Publish' }).click();
        await expect(row.getByRole('button', { name: 'Unpublish' })).toBeVisible();
        await api.waitForMail({ to: member.email, template: 'events_status_changed.html' });

        // Members find it in the list.
        await loginInBrowser(page, api, 'member');
        await page.goto('/events');
        await page.getByRole('textbox', { name: 'Search by name or description' }).fill(name);
        await expect(page.getByRole('article', { name }).getByRole('link', { name: 'Apply!' })).toHaveAttribute('href', `/events/${url}/applications/me`);
    });
});
