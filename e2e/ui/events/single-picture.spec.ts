// The picture dialog of the event page (/events/:id, "Change picture"): uploading a new header
// image.
import { ok, unprocessable } from '../support/factories/base.ts';
import { eventOrganizerPermissions, organizedEvent } from '../support/factories/events.ts';
import { dialog, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const PNG = { name: 'head.png', mimeType: 'image/png', buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) };

test.describe('changing the picture of an event', () => {
    test.beforeEach(({ api }) => {
        api.json('GET events /single/:id', ok(organizedEvent({ id: 9, url: 'draft-1', name: 'Spring Training', status: 'draft' }), { permissions: eventOrganizerPermissions('draft') }));
    });

    test('organisers upload a new picture and the page loads again with it', async ({ page, api }) => {
        api.json('POST events /single/:id/upload', { success: true, message: 'File uploaded successfully', data: 'new-head.png' });
        await page.goto('/events/draft-1');

        await page.getByRole('button', { name: 'Change picture' }).click();
        const modal = dialog(page, 'Change picture');
        await expect(modal.getByText('Not set.')).toBeVisible();
        await modal.getByLabel(/Choose a file/).setInputFiles(PNG);
        await expect(modal.getByText('head.png')).toBeVisible();
        await modal.getByRole('button', { name: 'Upload!' }).click();

        // The whole page is loaded again (too soon to read the toast it shows), and asks for the
        // event again.
        await expect.poll(() => api.callsTo('GET events /single/:id').length).toBe(2);
        await expect(page.getByRole('heading', { name: 'Spring Training' })).toBeVisible();
        const [upload] = api.callsTo('POST events /single/:id/upload');
        expect(upload.params.id).toBe('9');
        expect(upload.parts).toEqual([{ name: 'head_image', filename: 'head.png', contentType: 'image/png' }]);
    });

    test('"Upload!" can only be used once a file is chosen', async ({ page, api }) => {
        await page.goto('/events/draft-1');

        await page.getByRole('button', { name: 'Change picture' }).click();

        await expect(dialog(page, 'Change picture').getByRole('button', { name: 'Upload!' })).toBeDisabled();
        expect(api.callsTo('POST events /single/:id/upload')).toHaveLength(0);
    });

    test('a refused upload shows why and keeps the dialog open', async ({ page, api }) => {
        api.on('POST events /single/:id/upload', { status: 422, json: unprocessable('Malformed file content.') });
        await page.goto('/events/draft-1');

        await page.getByRole('button', { name: 'Change picture' }).click();
        const modal = dialog(page, 'Change picture');
        await modal.getByLabel(/Choose a file/).setInputFiles(PNG);
        await modal.getByRole('button', { name: 'Upload!' }).click();

        await expect(toast(page, 'Could not update image: Malformed file content.')).toBeVisible();
        await expect(modal).toBeVisible();
        expect(api.callsTo('GET events /single/:id')).toHaveLength(1);
    });

    test('the dialog closes with its close button', async ({ page }) => {
        await page.goto('/events/draft-1');

        await page.getByRole('button', { name: 'Change picture' }).click();
        await dialog(page, 'Change picture').getByRole('button', { name: 'close' }).click();

        await expect(dialog(page, 'Change picture')).toHaveCount(0);
    });
});
