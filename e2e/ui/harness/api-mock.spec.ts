// What the API mock (ui/support/api-mock.ts) can do beyond answering JSON, shown on real pages:
// network errors, downloads, file uploads, requests outside /api, fallback answers and the
// strict mode that fails a test for a request nobody answered.
import { ok } from '../support/factories/base.ts';
import { application, event, eventSummary, organizerPermissions } from '../support/factories/events.ts';
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

        // The map needs WebGL, which the browsers of CI and of a developer's machine have (in
        // software where there is no GPU). Without it there would be no style request.
        expect(await page.evaluate(() => {
            const context = document.createElement('canvas').getContext('webgl');
            return context ? String(context.getParameter(context.VERSION)) : 'no WebGL';
        })).toMatch(/^WebGL/);
        await expect.poll(() => api.callsTo('GET url https://api.maptiler.com/**')).toHaveLength(1);
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

    test('a route that could never match is refused where it is written', async ({ api }) => {
        const refused = (route: string): string => {
            try {
                api.on(route, { json: ok([]) });
            } catch (error) {
                return (error as Error).message;
            }
            return 'accepted';
        };

        expect(refused('get events /')).toContain('the method "get" is not one of GET, POST, PUT, PATCH, DELETE or *. Did you mean GET?');
        expect(refused('FETCH events /')).toContain('the method "FETCH"');
        expect(refused('GET events/')).toContain('needs three parts separated by one space each (method, service, path), and has 2');
        expect(refused('GET events')).toContain('has 2');
        expect(refused('GET  events /')).toContain('three parts separated by one space each');
        expect(refused(' GET events /')).toContain('spaces around it');
        expect(refused('POST evnts /')).toContain('the service "evnts" is not one of core, events, summeruniversity, statutory, discounts, network, mailer (or url, or *). Did you mean events?');
        expect(refused('GET Events /')).toContain('Did you mean events?');
        expect(refused('GET events single/1')).toContain('has to start with a slash');
        expect(refused('GET events /api/events/single/1')).toContain('without the /api/<service> prefix');
        expect(refused('GET events /?search=x')).toContain('no query string');
        expect(refused('GET events /single//applications')).toContain('empty segment');
        expect(refused('GET events /single/*')).toContain('* inside a path matches nothing');
        expect(refused('GET events /single/:')).toContain(':parameter is a whole path segment');
        expect(refused('GET url /media/**')).toContain('api.url(method, glob, respond)');
        expect(refused('GET events /'), 'the message shows how a route is written').toBe('accepted');

        // The same check where calls are counted: a typo there would read as "no call was made".
        expect(() => api.callsTo('POST evnts /')).toThrow(/the service "evnts"/);
        expect(() => api.callsTo('get events /')).toThrow(/the method "get"/);
        expect(() => api.callsTo('GET url media/**')).toThrow(/a url pattern starts with \//);
        expect(() => api.url('GET', 'api.github.com/**', { json: [] })).toThrow(/a url pattern starts with \//);
        // A handler that nothing has to ask for says why, as a coverage exception does.
        const optional = (reason: string): (() => unknown) => () => api.json('GET events /mine', ok([]), { optional: reason });
        expect(optional('maybe')).toThrow(/"maybe" needs at least 4 words and 20 characters/);
        expect(optional('x y z')).toThrow(/"x y z" needs at least 4 words and 20 characters/);
        expect(optional('todo: say why this is optional')).toThrow(/is a placeholder \("todo"\)/);
        expect(optional('the page is too hard to mock here')).toThrow(/is not a reason \("too hard to mock"\)/);
        expect(optional('really really really really')).toThrow(/needs at least 4 different words/);

        // Accepted above, and nothing asks for it here.
        expect(api.unused).toEqual(['GET events /']);
        api.json('GET events /', ok([]), { optional: 'only registered to show what is accepted' });
        expect(api.unused).toEqual([]);
    });

    test('a handler nobody called is fine when it says why, when it was replaced, or when it is a fallback', async ({ page, api }) => {
        api.json('GET events /', ok([eventSummary({ name: 'Replaced by the next answer' })]));
        api.json('GET events /', ok([]));
        api.json('GET events /mine/participating', ok([]), { optional: 'this test never opens "my events"' });
        api.fallback(() => api.json('GET events /mine/organizing', ok([])));

        await page.goto('/events');

        await expect(page.getByText('No events found.')).toBeVisible();
        expect(api.unused).toEqual([]);
        expect([...new Set(api.callsTo('* * *').map((call) => `${call.method} ${call.service} ${call.path}`))].sort()).toEqual(['GET core /members/me', 'GET core /my_permissions', 'GET events /']);
    });

    test('a handler counts as used when its request comes after the test\'s last step', async ({ page, api }) => {
        api.json('GET events /', ok([]));
        api.json('GET events /mine/organizing', ok([]));
        await page.goto('/events');
        await expect(page.getByText('No events found.')).toBeVisible();

        // Nothing has asked for the second one yet; the page does 300 ms from now.
        await page.evaluate(() => { setTimeout(() => fetch('/api/events/mine/organizing'), 300); });
        expect(api.unused).toEqual(['GET events /mine/organizing']);
        // What every test does when it ends (ui/support/test.ts): it waits for that request…
        const waited = Date.now();
        expect(await api.stillUnused(5000)).toEqual([]);
        expect(Date.now() - waited).toBeLessThan(4000);

        // …and not at all when every handler was used, so only a test that is about to fail waits.
        const returned = Date.now();
        expect(await api.stillUnused(5000)).toEqual([]);
        expect(Date.now() - returned).toBeLessThan(1000);

        // A handler that nothing ever asks for is still reported, after the time it was given.
        api.json('GET events /mine/participating', ok([]));
        expect(await api.stillUnused(200)).toEqual(['GET events /mine/participating']);
        api.json('GET events /mine/participating', ok([]), { optional: 'only registered to show that it is reported' });
    });

    test('the suite\'s server answers pages and files of the build, and nothing else', async ({ baseURL }) => {
        // Asked from the test itself, so past the mock: this is what the server alone says.
        const get = async (address: string, accept: string): Promise<string> => {
            const response = await fetch(new URL(address, baseURL), { headers: { accept } });
            return `${response.status} ${(response.headers.get('content-type') ?? '').split(';')[0]}`;
        };

        // A page of the app, whatever its path: the router of the app decides what it is.
        expect(await get('/events/spring', 'text/html,application/xhtml+xml')).toBe('200 text/html');
        expect(await get('/', '*/*')).toBe('200 text/html');
        expect(await get('/index.html', '*/*')).toBe('200 text/html');
        // What the app's fetch() gets for an address that is nearly the API's.
        expect(await get('/apii/events/', 'application/json, text/plain, */*')).toBe('404 application/json');
        expect(await get('/api', '*/*')).toBe('404 application/json');
        expect(await get('/API/events/', '*/*')).toBe('404 application/json');
        expect(await get('/js/no-such-chunk.js', '*/*')).toBe('404 application/json');
        // Under /api it is a request the mock should have answered.
        expect(await get('/api/events/', '*/*')).toBe('501 application/json');
    });

    test.describe('strict mode', () => {
        // The check at the end of every test is what this is about, so do it by hand here.
        // eslint-disable-next-line e2e-no-weakened-checks -- the strict check itself is under test here: these tests read api.unhandled by hand
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

        test('and a request to this origin that is neither /api, a file of the build nor a page', async ({ page, api }) => {
            await page.goto('/about');

            // The last two are files of the build, which the page may ask for.
            const statuses = await page.evaluate(() => Promise.all(['/apii/events/', '/api', '/API/events/', '/status.json', '/healthcheck'].map(async (address) => (await fetch(address)).status)));

            expect(statuses).toEqual([404, 404, 404, 200, 200]);
            expect(api.unhandled.map((call) => `${call.method} ${call.service} ${new URL(call.path).pathname} ${call.status}`)).toEqual([
                'GET url /apii/events/ 404', 'GET url /api 404', 'GET url /API/events/ 404'
            ]);
        });

        test('and a request from a second page of the test', async ({ page, context, api }) => {
            await page.goto('/about');
            const second = await context.newPage();
            await second.goto('/about');

            expect(await second.evaluate(async () => (await fetch('/api/statutory/')).status)).toBe(501);

            expect(api.unhandled.map((call) => `${call.method} ${call.service} ${call.path}`)).toEqual(['GET statutory /']);
            // Both pages asked who is logged in, and both got the mock's answer.
            expect(api.callsTo('GET core /members/me').map((call) => call.status)).toEqual([200, 200]);
        });
    });
});
