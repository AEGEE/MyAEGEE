// What the API mock (ui/support/api-mock.ts) can do beyond answering JSON, shown on real pages:
// network errors, downloads, file uploads, requests outside /api, fallback answers and the
// strict mode that fails a test for a request nobody answered.
import { ok } from '../support/factories/base.ts';
import { application, event, organizerPermissions } from '../support/factories/events.ts';
import { mockMap } from '../support/map.ts';
import { dialog, toast } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { test, expect } from '../support/test.ts';

test.describe('API mock', () => {
    test('a request can fail on the network', async ({ page, api }) => {
        api.on('GET events /', { abort: 'failed' });

        await page.goto('/events');

        await expect(toast(page, 'Could not fetch events list: Network Error')).toBeVisible();
        expect(api.callsTo('GET events /').map((call) => call.status)).toEqual([0]);
    });

    test('a download gets a body that is not JSON', async ({ page, api }) => {
        api.json('GET events /single/:id', ok(event({ id: 9, url: 'spring' }), { permissions: organizerPermissions() }));
        api.json('GET events /single/:id/applications', ok([application()]));
        api.on('GET events /single/:id/applications/export', {
            body: Buffer.from('PK\u0003\u0004 not really a spreadsheet'),
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers: { 'content-disposition': 'attachment; filename="participants.xlsx"' }
        });
        await page.goto('/events/spring/participants');
        await expect(page.getByText('Total applications: 1.')).toBeVisible();

        const download = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Export' }).click();

        expect((await download).suggestedFilename()).toMatch(/^participants_.*\.xlsx$/);
        expect(api.callsTo('GET events /single/:id/applications/export')).toHaveLength(1);
    });

    test('an uploaded file is recorded with its name and form field', async ({ page, api }) => {
        api.json('GET events /single/:id', ok(event({ id: 9, url: 'spring', name: 'Spring Training' }), { permissions: organizerPermissions() }));
        api.json('POST events /single/:id/upload', ok({}));
        await page.goto('/events/spring');

        await page.getByRole('button', { name: 'Change picture' }).click();
        const modal = dialog(page).filter({ hasText: 'Change picture' });
        await modal.getByLabel(/Choose a file/).setInputFiles({ name: 'héad image.png', mimeType: 'image/png', buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) });
        await modal.getByText('Upload!').click();

        await expect.poll(() => api.callsTo('POST events /single/:id/upload')).toHaveLength(1);
        const [upload] = api.callsTo('POST events /single/:id/upload');
        expect(upload.contentType).toMatch(/^multipart\/form-data; boundary=/);
        expect(upload.parts).toEqual([{ name: 'head_image', filename: 'héad image.png', contentType: 'image/png' }]);
        expect(upload.raw?.includes(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBe(true);
    });

    test('requests outside /api are answered and recorded by URL', async ({ page, api }) => {
        api.json('GET events /', ok([]));
        api.json('GET summeruniversity /', ok([]));
        api.json('GET statutory /', ok([]));
        api.url('GET', '/services/calendar-cors/**', {
            body: 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n',
            contentType: 'text/calendar'
        });

        await page.goto('/calendar');

        await expect.poll(() => api.callsTo('GET url /services/calendar-cors/**')).toHaveLength(1);
        expect(api.callsTo('GET url /services/calendar-cors/**')[0].path).toMatch(/\/services\/calendar-cors\/calendar\/ical\/.+\/public\/basic\.ics$/);
    });

    test('a request to another host is blocked unless the test answers it', async ({ page, api }) => {
        api.url('GET', 'https://api.github.com/**', { json: [{ name: 'answered by the test' }] });
        await page.goto('/about');

        const answered = await page.evaluate(async () => (await fetch('https://api.github.com/repos/AEGEE/MyAEGEE/tags')).json());
        const blocked = await page.evaluate(() => fetch('https://example.com/').then(() => 'reached', () => 'blocked'));

        expect(answered).toEqual([{ name: 'answered by the test' }]);
        expect(blocked).toBe('blocked');
        expect(api.callsTo('GET url https://api.github.com/**').map((call) => call.path)).toEqual(['https://api.github.com/repos/AEGEE/MyAEGEE/tags']);
    });

    test('a page with a map gets its style from the mock', async ({ page, api }) => {
        mockMap(api);
        api.json('GET events /single/:id', ok(event({
            id: 9, url: 'spring', name: 'Spring Training', locations: [{ name: 'Brussels', position: { lat: 50.85, lng: 4.35 } }]
        }), { permissions: organizerPermissions() }));

        await page.goto('/events/spring');
        await expect(page.getByRole('heading', { name: 'Spring Training', level: 1 })).toBeVisible();

        // The map only starts where the browser has WebGL (ui/shell/navigation.spec.ts logs
        // whether it does); without it there is no style request to check.
        const webgl = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl'));
        if (webgl) await expect.poll(() => api.callsTo('GET url https://api.maptiler.com/**')).toHaveLength(1);
    });

    test('fallback answers only step in where the test has none', async ({ page, api }) => {
        api.fallback(mockEverything);
        api.json('GET events /', ok([]));

        await page.goto('/events');
        // The test's own answer wins over the fallback, which has three events.
        await expect(page.getByText('No events found.')).toBeVisible();

        // Another area's page, which this test knows nothing about, still loads.
        await page.goto('/bodies');
        await expect(page).toHaveTitle('MyAEGEE | View bodies');
        expect(api.unhandled).toEqual([]);
    });

    test.describe('strict mode', () => {
        // The check at the end of every test is what this is about, so do it by hand here.
        test.use({ strictApi: false });

        test('a request nobody answered is recorded as unhandled', async ({ page, api }) => {
            await page.goto('/events');

            await expect.poll(() => api.unhandled.map((call) => `${call.method} ${call.service} ${call.path}`)).toEqual(['GET events /']);
            expect(api.unhandled[0].status).toBe(501);
        });

        test('so is a request to one of the gateway\'s proxies', async ({ page, api }) => {
            await page.goto('/about');

            await page.evaluate(() => fetch('/services/jira-cors/wiki/rest/api/content/1').then((response) => response.status));

            expect(api.unhandled.map((call) => `${call.method} ${call.service} ${new URL(call.path).pathname}`)).toEqual(['GET url /services/jira-cors/wiki/rest/api/content/1']);
        });
    });
});
