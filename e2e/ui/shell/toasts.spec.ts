// Toasts: the messages the app shows after an action. They go away by themselves, and stay
// longer the more there is to read.
import { validationError } from '../support/factories/base.ts';
import { freezeTime, passTime, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

test.describe('toasts', () => {
    test('a short message is gone after three seconds', async ({ page, api }) => {
        await freezeTime(page);
        api.on('GET events /', { status: 500, json: { success: false, message: 'Down' } });
        await page.goto('/events');

        const message = toast(page, 'Could not fetch events list: Down');
        await expect(message).toBeVisible();
        await passTime(page, 2500);
        await expect(message).toBeVisible();
        await passTime(page, 1000);
        await expect(message).toBeHidden();
    });

    test('an error that lists several validation messages stays long enough to read', async ({ page, api }) => {
        await freezeTime(page);
        api.on('GET events /', {
            status: 422,
            json: validationError({
                starts: ['Event start date should be set.', 'Event cannot start in the past.'],
                application_ends: ['Application period cannot end before it starts.']
            })
        });
        await page.goto('/events');

        // 143 characters: more than twice the three seconds of a short message.
        const message = toast(page, 'Could not fetch events list: Event start date should be set.; Event cannot start in the past.; Application period cannot end before it starts.');
        await expect(message).toBeVisible();
        await passTime(page, 7000);
        await expect(message).toBeVisible();
        // …and not for ever: ten seconds at most.
        await passTime(page, 3500);
        await expect(message).toBeHidden();
    });
});
