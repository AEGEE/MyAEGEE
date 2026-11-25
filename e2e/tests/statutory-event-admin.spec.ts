// The statutory events flow end to end against the real services: an admin creates an Agora
// through the form, publishes it, finds it in the list, edits it and gives it a picture. The
// detailed behaviour of these pages is covered by the mocked-API suite in ui/statutory/.
import fs from 'node:fs';
import path from 'node:path';

import type { Page } from '@playwright/test';

import type { Envelope } from '../support/api.ts';
import { test, expect, loginInBrowser } from '../support/api.ts';
import { serviceEnv } from '../support/constants.ts';
import { ONE_PIXEL_PNG } from '../support/core-data.ts';

const DEADLINES = [
    'starts', 'ends', 'application_period_starts', 'application_period_ends', 'board_approve_deadline',
    'participants_list_publish_deadline', 'memberslist_submission_deadline', 'draft_proposal_deadline',
    'final_proposal_deadline', 'candidature_deadline', 'booklet_publication_deadline', 'updated_booklet_publication_deadline'
] as const;

interface CreatedEvent extends Record<(typeof DEADLINES)[number], string | null> {
    id: number;
    url: string;
    name: string;
    type: string;
    status: string;
    body_id: number;
    previous_agora_id: number | null;
}

const fillDate = async (page: Page, label: string | RegExp, value: string): Promise<void> => {
    const field = page.getByLabel(label);
    await field.fill(value);
    await field.press('Enter');
};

test.describe('statutory event administration', () => {
    test('an admin creates, publishes, edits and illustrates an Agora', async ({ api, page }) => {
        test.slow();
        const suffix = Math.random().toString(36).replace(/[^a-z]/g, '').slice(0, 8);
        const name = `Agora Flow ${suffix}`;
        const slug = `agora-flow-${suffix}`;
        const antenna = (await api.me('member')).bodies[0];

        await loginInBrowser(page, api, 'admin');
        await page.goto('/statutory');
        await page.getByRole('main').getByRole('link', { name: 'Create event' }).click();
        await expect(page).toHaveURL('/statutory/new');

        await page.getByLabel('Title').fill(name);
        await expect(page.getByLabel('Event URL')).toHaveValue(slug);
        await page.getByRole('textbox', { name: /^Description/ }).fill('Created by the **e2e** tests');
        await page.getByLabel('Fee').fill('20');
        await fillDate(page, 'Event start date', '2030-07-15 10:00');
        await fillDate(page, 'Event end date', '2030-07-18 16:00');
        await fillDate(page, 'Application period starts', '2030-05-01 10:00');
        await fillDate(page, 'Application period ends', '2030-05-31 23:00');
        await fillDate(page, 'Board approve deadline', '2030-06-05 12:00');
        await fillDate(page, 'Members list submission deadline', '2030-06-20 12:00');
        // The organising body comes from core's search.
        await page.getByLabel('Organising body').fill(antenna.name.slice(0, 8));
        await page.getByRole('button', { name: new RegExp(`^${antenna.name}`) }).click();
        await expect(page.getByRole('button', { name: `${antenna.name} (Click to unset)` })).toBeVisible();
        await page.getByRole('button', { name: 'Add new question' }).click();
        await page.getByRole('textbox', { name: 'Question 1 description' }).fill('Why do you want to come?');
        await page.getByRole('button', { name: 'Save event' }).click();

        await expect(page).toHaveURL(`/statutory/${slug}`);
        await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
        const created = await api.call<Envelope<CreatedEvent>>('admin', 'GET', `/api/statutory/events/${slug}`);
        expect(created.status).toBe(200);
        expect(created.body.data).toMatchObject({ name, type: 'agora', status: 'draft', body_id: antenna.id });
        // Suggested by the form from the start: 23:59 on the day 45 days, a month, two weeks and five days before.
        for (const field of ['draft_proposal_deadline', 'final_proposal_deadline', 'candidature_deadline', 'booklet_publication_deadline', 'updated_booklet_publication_deadline'] as const) {
            expect(created.body.data[field], field).not.toBeNull();
        }
        expect(Date.parse(created.body.data.participants_list_publish_deadline!) - Date.parse(created.body.data.board_approve_deadline!)).toBe(24 * 60 * 60 * 1000);

        await test.step('publishing it puts it on the list', async () => {
            await page.getByRole('button', { name: 'Publish', exact: true }).click();
            await page.getByRole('alertdialog', { name: 'Switching status' }).getByRole('button', { name: 'Switch status' }).click();
            await expect(page.getByRole('button', { name: 'Unpublish' })).toBeVisible();

            await page.goto('/statutory');
            await page.getByRole('textbox', { name: 'Search by name or description' }).fill(name);
            await expect(page.getByRole('article', { name })).toBeVisible();
        });

        await test.step('editing the title keeps the deadlines', async () => {
            await page.getByRole('article', { name }).getByRole('link', { name: 'Go to event page' }).click();
            await page.getByRole('link', { name: 'Edit event' }).click();
            await expect(page.getByLabel('Title')).toHaveValue(name);
            await page.getByLabel('Title').fill(`${name} edited`);
            await page.getByRole('button', { name: 'Save event' }).click();
            await expect(page.getByRole('heading', { name: `${name} edited`, level: 1 })).toBeVisible();

            const edited = await api.call<Envelope<CreatedEvent>>('admin', 'GET', `/api/statutory/events/${slug}`);
            expect(edited.body.data).toMatchObject({ name: `${name} edited`, url: slug, status: 'published', previous_agora_id: created.body.data.previous_agora_id });
            for (const field of DEADLINES) {
                expect(edited.body.data[field], field).toBe(created.body.data[field]);
            }
        });

        await test.step('a picture shows on the list', async () => {
            await page.getByRole('button', { name: 'Change picture' }).click();
            const modal = page.getByRole('dialog', { name: 'Change picture' });
            await modal.getByLabel(/Choose a file/).setInputFiles({ name: 'agora.png', mimeType: 'image/png', buffer: ONE_PIXEL_PNG });
            await modal.getByRole('button', { name: 'Upload!' }).click();
            await expect(modal).toHaveCount(0);
            const withPicture = await api.call<Envelope<{ image: { file_name: string; frontend_path: string } | null }>>('admin', 'GET', `/api/statutory/events/${slug}`);
            const image = withPicture.body.data.image!;
            expect(image.frontend_path).toBe(`/${image.file_name}`);
            await expect(page.getByRole('img', { name: `${name} edited` })).toHaveAttribute('src', `/media/statutory/${image.file_name}`);
            // The service keeps the file where the web server serves /media/statutory from (the
            // stack of the tests has no such server).
            expect(fs.readFileSync(path.join(serviceEnv('statutory').E2E_MEDIA_ROOT, 'statutory-media', image.file_name))).toEqual(ONE_PIXEL_PNG);

            await page.goto('/statutory');
            await page.getByRole('textbox', { name: 'Search by name or description' }).fill(name);
            await expect(page.getByRole('article', { name: `${name} edited` }).getByRole('img', { name: `${name} edited` }))
                .toHaveAttribute('src', `/media/statutory/${image.file_name}`);
        });
    });
});
