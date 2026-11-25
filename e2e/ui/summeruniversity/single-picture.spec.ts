// The "Change picture" dialog of the Summer University page (/summeruniversity/:id).
import { ok, unprocessable } from '../support/factories/base.ts';
import { suEvent, suOrganizerPermissions } from '../support/factories/summeruniversity.ts';
import { dialog, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

// A picture of one pixel.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

test.describe('changing the picture of a Summer University', () => {
    test.beforeEach(({ api }) => {
        api.json('GET summeruniversity /single/:id', ok(suEvent({ id: 21, url: 'mountains', status: 'second draft', locations: [] }), { permissions: suOrganizerPermissions('second draft') }));
    });

    test('organisers upload a new picture and the page loads again', async ({ page, api }) => {
        api.json('POST summeruniversity /single/:id/upload', { success: true, message: 'File uploaded successfully', data: 'new-picture.png' });

        await page.goto('/summeruniversity/mountains');
        await page.getByRole('button', { name: 'Change picture' }).click();

        const modal = dialog(page, 'Change picture');
        await expect(modal.getByText('Not set.')).toBeVisible();
        await modal.getByLabel(/Choose a file/).setInputFiles({ name: 'head.png', mimeType: 'image/png', buffer: PNG });
        await expect(modal.getByText('head.png')).toBeVisible();
        await modal.getByRole('button', { name: 'Upload!' }).click();

        // The page loads again, with the SU fetched anew (the reload takes the toast with it).
        await expect.poll(() => api.callsTo('GET summeruniversity /single/:id').length).toBe(2);
        await expect(page.getByRole('button', { name: 'Change picture' })).toBeVisible();
        await expect(dialog(page, 'Change picture')).toHaveCount(0);
        const [upload] = api.callsTo('POST summeruniversity /single/:id/upload');
        expect(upload.params).toEqual({ id: '21' });
        expect(upload.parts).toEqual([{ name: 'head_image', filename: 'head.png', contentType: 'image/png' }]);
    });

    test('"Upload!" sends nothing until a file is chosen', async ({ page, api }) => {
        await page.goto('/summeruniversity/mountains');
        await page.getByRole('button', { name: 'Change picture' }).click();

        await expect(dialog(page, 'Change picture').getByRole('button', { name: 'Upload!' })).toBeDisabled();
        expect(api.callsTo('POST summeruniversity /single/:id/upload')).toEqual([]);
    });

    test('a failed upload shows the reason and keeps the dialog open', async ({ page, api }) => {
        api.on('POST summeruniversity /single/:id/upload', { status: 422, json: unprocessable('Malformed file content.') });

        await page.goto('/summeruniversity/mountains');
        await page.getByRole('button', { name: 'Change picture' }).click();
        const modal = dialog(page, 'Change picture');
        await modal.getByLabel(/Choose a file/).setInputFiles({ name: 'head.png', mimeType: 'image/png', buffer: PNG });
        await modal.getByRole('button', { name: 'Upload!' }).click();

        await expect(toast(page, 'Could not update image: Malformed file content.')).toBeVisible();
        await expect(modal).toBeVisible();
        expect(api.callsTo('GET summeruniversity /single/:id')).toHaveLength(1);
    });

    test('the dialog closes with its close button', async ({ page }) => {
        await page.goto('/summeruniversity/mountains');
        await page.getByRole('button', { name: 'Change picture' }).click();
        const modal = dialog(page, 'Change picture');
        await expect(modal).toBeVisible();

        await modal.getByRole('button', { name: 'close' }).click();

        await expect(modal).toHaveCount(0);
    });
});
