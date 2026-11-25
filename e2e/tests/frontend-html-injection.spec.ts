import { test, expect, loginInBrowser, moveToModule } from '../support/api.ts';

// The markdown and toast checks of this file are in the mocked-API suite now
// (ui/shell/html-and-toasts.spec.ts).

test.describe('HTML injection in the frontend', () => {
    test('links typed in by users only open when they are http(s) links', moveToModule('frontend', 'once the frontend has component tests for the safeUrl filter'), async ({ api, page }) => {
        const event = await api.createEvent('admin', { type: 'training' });
        await api.publishAsAdmin(event.id);
        const body = (await api.me('member')).bodies[0];

        // The backend rejects links like these, so they're put in the API responses
        // to test the frontend on its own (and data stored before the validation).
        const replaceInResponse = (url: RegExp, changes: Record<string, string>) => page.route(url, async (route) => {
            if (route.request().method() !== 'GET') {
                return route.fallback();
            }

            const response = await route.fetch();
            const json = await response.json();
            Object.assign(json.data, changes);
            return route.fulfill({ response, json });
        });

        await replaceInResponse(/\/api\/events\/single\/[^/?]+$/, {
            // eslint-disable-next-line no-script-url -- the injected link is what the test checks
            budget: 'javascript:window.__injected=\'budget\'',
            programme: 'www.aegee.org/programme',
            link_info_travel_country: ' data:text/html,<script>window.__injected=\'travel\'</script>'
        });
        await replaceInResponse(new RegExp(`/api/core/bodies/${body.id}$`), {
            // eslint-disable-next-line no-script-url -- the injected link is what the test checks
            website: 'JaVaScRiPt:window.__injected=\'website\''
        });

        await loginInBrowser(page, api, 'member');
        await page.goto(`/events/${event.url}`);

        // The text stays visible, but not as a link: these open in a new tab, so clicking them
        // wouldn't show anything here; without a link (an <a> without href isn't one), there's
        // nothing to open.
        const budget = 'window.__injected=\'budget\'';
        await expect(page.getByText(budget)).toBeVisible();
        await expect(page.getByRole('link', { name: budget })).toHaveCount(0);

        const travel = 'window.__injected=\'travel\'';
        await expect(page.getByText(travel)).toBeVisible();
        await expect(page.getByRole('link', { name: travel })).toHaveCount(0);

        // A link without a scheme opens as https instead of as a page of MyAEGEE.
        await expect(page.getByRole('link', { name: 'www.aegee.org/programme' })).toHaveAttribute('href', 'https://www.aegee.org/programme');

        await page.goto(`/bodies/${body.id}`);
        const website = 'window.__injected=\'website\'';
        await expect(page.getByText(website)).toBeVisible();
        await expect(page.getByRole('link', { name: website })).toHaveCount(0);
    });
});
