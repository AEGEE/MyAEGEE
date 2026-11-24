// Statutory events list (/statutory) and the "Statutory events" part of the sidebar menu: the
// published Agorae, EPMs and SPMs, how to find one, and who gets the links to manage them.
import fs from 'node:fs';
import path from 'node:path';

import type { Page } from '@playwright/test';

import { ok } from '../support/factories/base.ts';
import { permission } from '../support/factories/core.ts';
import { statutoryEventSummary, statutoryImage } from '../support/factories/statutory-events.ts';
import { openMenu, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const PICTURE = fs.readFileSync(path.join(import.meta.dirname, '../fixtures/statutory/agora-logo.png'));

// The event cards (the page itself is an article too, without a name).
const cards = (page: Page) => page.getByRole('article', { name: /\S/ });

const XSS = '**bold** <img src=x onerror="window.__xss=1"><script>window.__xss=2</script> [x](javascript:window.__xss=3)';

test.describe('statutory events list', () => {
    test('lists the published events with their type, dates and links', async ({ page, api }) => {
        api.json('GET statutory /', ok([
            statutoryEventSummary({
                id: 1,
                name: 'Agora Spring',
                url: 'agora-spring',
                type: 'agora',
                description: 'The **Spring Agora** of the network.',
                // 09:00 UTC is 10:00 or 11:00 in Brussels: the dates are shown in the browser's zone.
                starts: '2027-04-15T09:00:00.000Z',
                ends: '2027-04-18T09:00:00.000Z',
                application_period_starts: '2027-02-01T09:00:00.000Z',
                application_period_ends: '2027-03-01T09:00:00.000Z'
            }),
            statutoryEventSummary({ id: 2, name: 'EPM Autumn', url: 'epm-autumn', type: 'epm' }),
            statutoryEventSummary({ id: 3, name: 'SPM Winter', url: 'spm-winter', type: 'spm' })
        ]));

        await page.goto('/statutory');

        await expect(page.getByRole('heading', { name: 'Statutory events list' })).toBeVisible();
        await expect(page).toHaveTitle('MyAEGEE | List all statutory events');

        const agora = page.getByRole('article', { name: 'Agora Spring' });
        await expect(agora.getByText('Spring Agora')).toHaveJSProperty('tagName', 'STRONG');
        await expect(agora.getByRole('listitem').filter({ hasText: 'Type:' })).toHaveText('Type: Agora');
        await expect(agora.getByRole('listitem').filter({ hasText: 'From:' })).toHaveText('From: 2027-04-15');
        await expect(agora.getByRole('listitem').filter({ hasText: 'To:' })).toHaveText('To: 2027-04-18');
        await expect(agora.getByRole('listitem').filter({ hasText: 'Application period:' })).toHaveText(/Application period:\s+from 2027-02-01 to 2027-03-01/);
        await expect(agora.getByRole('link', { name: 'Agora Spring' })).toHaveAttribute('href', '/statutory/agora-spring');
        await expect(agora.getByRole('link', { name: 'Go to event page' })).toHaveAttribute('href', '/statutory/agora-spring');

        await expect(page.getByRole('article', { name: 'EPM Autumn' }).getByRole('listitem').filter({ hasText: 'Type:' })).toHaveText('Type: EPM');
        await expect(page.getByRole('article', { name: 'SPM Winter' }).getByRole('listitem').filter({ hasText: 'Type:' })).toHaveText('Type: SPM');
        await expect(page.getByText('No events found.')).toBeHidden();
    });

    test('an event card shows the event\'s picture, or the logo without one', async ({ page, api }) => {
        api.json('GET statutory /', ok([
            statutoryEventSummary({ id: 1, name: 'Agora Spring', image_id: 3, image: statutoryImage({ frontend_path: '/agora-logo.png' }) }),
            statutoryEventSummary({ id: 2, name: 'EPM Autumn', url: 'epm-autumn', type: 'epm' })
        ]));
        api.url('GET', '/media/statutory/agora-logo.png', { body: PICTURE, contentType: 'image/png' });

        await page.goto('/statutory');

        await expect(page.getByRole('article', { name: 'Agora Spring' }).getByRole('img', { name: 'Agora Spring' }))
            .toHaveAttribute('src', '/media/statutory/agora-logo.png');
        // The logo is decoration: it has an empty text alternative.
        const autumn = page.getByRole('article', { name: 'EPM Autumn' });
        await expect(autumn.getByRole('img')).toHaveCount(0);
        await expect(autumn.getByRole('presentation')).toHaveAttribute('src', '/images/logo.png');
    });

    test('the links of an event without a URL use its id', async ({ page, api }) => {
        api.json('GET statutory /', ok([statutoryEventSummary({ id: 14, name: 'Agora Spring', url: '' })]));

        await page.goto('/statutory');

        const card = page.getByRole('article', { name: 'Agora Spring' });
        await expect(card.getByRole('link', { name: 'Agora Spring' })).toHaveAttribute('href', '/statutory/14');
        await expect(card.getByRole('link', { name: 'Go to event page' })).toHaveAttribute('href', '/statutory/14');
        await expect(card.getByRole('link', { name: 'Apply' })).toHaveAttribute('href', '/statutory/14/applications/me');
    });

    test('"Apply" is only offered while the application period is open', async ({ page, api }) => {
        api.json('GET statutory /', ok([
            statutoryEventSummary({ id: 1, name: 'Agora Spring', url: 'agora-spring', can_apply: true }),
            statutoryEventSummary({ id: 2, name: 'EPM Autumn', url: 'epm-autumn', type: 'epm', can_apply: false })
        ]));

        await page.goto('/statutory');

        await expect(page.getByRole('article', { name: 'Agora Spring' }).getByRole('link', { name: 'Apply' }))
            .toHaveAttribute('href', '/statutory/agora-spring/applications/me');
        await expect(page.getByRole('article', { name: 'EPM Autumn' }).getByRole('link', { name: 'Go to event page' })).toBeVisible();
        await expect(page.getByRole('article', { name: 'EPM Autumn' }).getByRole('link', { name: 'Apply' })).toHaveCount(0);
    });

    for (const combined of ['global:manage_event:agora', 'global:manage_event:epm']) {
        test(`a member with ${combined} can create an event`, async ({ page, api, myPermissions }) => {
            myPermissions.push(permission(combined));
            api.json('GET statutory /', ok([]));

            await page.goto('/statutory');

            await expect(page.getByRole('main').getByRole('link', { name: 'Create event' })).toHaveAttribute('href', '/statutory/new');
        });
    }

    test('a member without a permission to manage events gets no "Create event"', async ({ page, api }) => {
        api.json('GET statutory /', ok([statutoryEventSummary({ name: 'Agora Spring' })]));

        await page.goto('/statutory');

        await expect(page.getByRole('article', { name: 'Agora Spring' })).toBeVisible();
        await expect(page.getByRole('main').getByRole('link', { name: 'Create event' })).toHaveCount(0);
    });

    test('searching asks for the matching events, and clearing the search lists all again', async ({ page, api }) => {
        api.on('GET statutory /', ({ query }) => ({
            json: ok(query.get('search') === 'autumn'
                ? [statutoryEventSummary({ id: 2, name: 'EPM Autumn', type: 'epm' })]
                : [statutoryEventSummary({ id: 1, name: 'Agora Spring' }), statutoryEventSummary({ id: 2, name: 'EPM Autumn', type: 'epm' })])
        }));

        await page.goto('/statutory');
        await expect(page.getByRole('article', { name: 'Agora Spring' })).toBeVisible();
        expect(api.callsTo('GET statutory /')[0].query.has('search')).toBe(false);

        const search = page.getByRole('textbox', { name: 'Search by name or description' });
        await search.fill('autumn');
        await expect(page.getByRole('article', { name: 'Agora Spring' })).toHaveCount(0);
        await expect(page.getByRole('article', { name: 'EPM Autumn' })).toBeVisible();
        expect(api.callsTo('GET statutory /').at(-1)?.query.get('search')).toBe('autumn');

        await search.fill('');
        await expect(page.getByRole('article', { name: 'Agora Spring' })).toBeVisible();
        await expect(cards(page)).toHaveCount(2);
        expect(api.callsTo('GET statutory /').at(-1)?.query.has('search')).toBe(false);
    });

    test('searching asks only for the events again, not for the member\'s permissions', async ({ page, api }) => {
        api.json('GET statutory /', ok([statutoryEventSummary({ name: 'Agora Spring' })]));

        await page.goto('/statutory');
        await expect(page.getByRole('article', { name: 'Agora Spring' })).toBeVisible();
        const before = api.callsTo('GET core /my_permissions').length;

        await page.getByRole('textbox', { name: 'Search by name or description' }).fill('agora');

        await expect.poll(() => api.callsTo('GET statutory /').length).toBe(2);
        await expect(page.getByRole('article', { name: 'Agora Spring' })).toBeVisible();
        expect(api.callsTo('GET core /my_permissions')).toHaveLength(before);
    });

    test('when the search changes before the answer comes, only the last answer is shown', async ({ page, api }) => {
        api.on('GET statutory /', ({ query }) => {
            if (query.get('search') === 'spr') return { json: ok([statutoryEventSummary({ id: 1, name: 'Agora Spring' })]), delayMs: 1500 };
            if (query.get('search') === 'aut') return { json: ok([statutoryEventSummary({ id: 2, name: 'EPM Autumn', type: 'epm' })]) };
            return { json: ok([]) };
        });

        await page.goto('/statutory');
        await expect(page.getByText('No events found.')).toBeVisible();

        const search = page.getByRole('textbox', { name: 'Search by name or description' });
        await search.fill('spr');
        await search.fill('aut');

        await expect(page.getByRole('article', { name: 'EPM Autumn' })).toBeVisible();
        // The first answer arrives after the second one, and is dropped without an error.
        await expect.poll(() => api.callsTo('GET statutory /').filter((call) => call.query.get('search') === 'spr').length).toBe(1);
        await expect(page.getByRole('article', { name: 'Agora Spring' })).toHaveCount(0);
        await expect(cards(page)).toHaveCount(1);
        expect(await page.getByRole('alert').count()).toBe(0);
    });

    test('says so when there are no events', async ({ page, api }) => {
        api.json('GET statutory /', ok([]));

        await page.goto('/statutory');

        await expect(page.getByText('No events found.')).toBeVisible();
        await expect(cards(page)).toHaveCount(0);
    });

    test('all events come in one answer, without paging', async ({ page, api }) => {
        const events = Array.from({ length: 31 }, (_, index) => statutoryEventSummary({ id: index + 1, name: `Agora ${index + 1}`, url: `agora-${index + 1}` }));
        api.json('GET statutory /', ok(events));

        await page.goto('/statutory');

        await expect(cards(page)).toHaveCount(31);
        await expect(page.getByRole('button', { name: 'Load more events' })).toHaveCount(0);
        const [call] = api.callsTo('GET statutory /');
        expect([...call.query.keys()]).toEqual([]);
    });

    test('when the events can\'t be loaded, it says so', async ({ page, api }) => {
        api.on('GET statutory /', { status: 500, json: { success: false, message: 'Database is down' } });

        await page.goto('/statutory');

        await expect(toast(page, 'Could not fetch statutory events list: Database is down')).toBeVisible();
        await expect(page.getByText('No events found.')).toBeVisible();
    });

    test('event descriptions are shown as markdown without running scripts', async ({ page, api }) => {
        api.json('GET statutory /', ok([statutoryEventSummary({ name: 'Agora Spring', description: XSS })]));
        // The picture of the description fails to load, which is when its handler would run.
        const picture = new Promise<void>((resolve) => {
            api.url('GET', '/x', () => {
                resolve();
                return { status: 404, body: '' };
            });
        });

        await page.goto('/statutory');

        const card = page.getByRole('article', { name: 'Agora Spring' });
        await expect(card.getByText('bold')).toHaveJSProperty('tagName', 'STRONG');
        await expect(card.getByText('x', { exact: true })).toBeVisible();
        await expect(card.getByText('x', { exact: true })).not.toHaveAttribute('href', /javascript:/);
        await expect(card.getByRole('img')).not.toHaveAttribute('onerror');
        await picture;
        expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    });
});

test.describe('statutory events menu', () => {
    test('a member finds all statutory events in the menu, and nothing to manage them', async ({ page, api, layout }) => {
        api.json('GET statutory /', ok([]));
        await page.goto('/statutory');
        await expect(page.getByText('No events found.')).toBeVisible();

        const menu = await openMenu(page, layout);
        await expect(menu.getByText('Statutory events', { exact: true })).toBeVisible();
        const listing = menu.getByRole('button', { name: 'Statutory listing' });
        if (await listing.getAttribute('aria-expanded') !== 'true') await listing.click();
        await expect(listing).toHaveAttribute('aria-expanded', 'true');
        await expect(menu.getByRole('link', { name: 'All statutory events' })).toHaveAttribute('href', '/statutory');
        await expect(menu.getByRole('link', { name: 'Create event' })).toHaveCount(0);
        await expect(menu.getByRole('link', { name: 'Participants types amount' })).toHaveCount(0);
        await expect(menu.getByRole('link', { name: 'Background tasks' })).toHaveCount(0);
    });

    test('a group of statutory events opens and closes', async ({ page, api, layout }) => {
        api.json('GET statutory /', ok([]));
        await page.goto('/statutory');
        await expect(page.getByText('No events found.')).toBeVisible();

        const menu = await openMenu(page, layout);
        const listing = menu.getByRole('button', { name: 'Statutory listing' });
        const expanded = await listing.getAttribute('aria-expanded');
        await listing.click();
        await expect(listing).not.toHaveAttribute('aria-expanded', expanded!);
        await listing.click();
        await expect(listing).toHaveAttribute('aria-expanded', expanded!);
    });

    for (const combined of ['global:manage_event:agora', 'global:manage_event:epm', 'global:manage_event:spm']) {
        test(`${combined} gives the menu links to create events and to set participants limits`, async ({ page, api, layout, myPermissions }) => {
            myPermissions.push(permission(combined));
            api.json('GET statutory /', ok([]));
            await page.goto('/statutory');
            await expect(page.getByText('No events found.')).toBeVisible();

            const menu = await openMenu(page, layout);
            const listing = menu.getByRole('button', { name: 'Statutory listing' });
            if (await listing.getAttribute('aria-expanded') !== 'true') await listing.click();
            await expect(menu.getByRole('link', { name: 'Create event' })).toHaveAttribute('href', '/statutory/new');
            await expect(menu.getByRole('link', { name: 'Participants types amount' })).toHaveAttribute('href', '/statutory/limits');
            await expect(menu.getByRole('link', { name: 'Background tasks' })).toHaveCount(0);
        });
    }

    test('global:see_background_tasks:statutory gives the menu link to the background tasks', async ({ page, api, layout, myPermissions }) => {
        myPermissions.push(permission('global:see_background_tasks:statutory'));
        api.json('GET statutory /', ok([]));
        await page.goto('/statutory');
        await expect(page.getByText('No events found.')).toBeVisible();

        const menu = await openMenu(page, layout);
        await expect(menu.getByRole('link', { name: 'Background tasks' })).toHaveAttribute('href', '/statutory/tasks');
        await expect(menu.getByRole('link', { name: 'Participants types amount' })).toHaveCount(0);
    });

    test.describe('anonymously', () => {
        test.use({ session: 'anonymous' });

        test('a visitor gets no statutory events in the menu', async ({ page, layout }) => {
            await page.goto('/statutory');
            await expect(page).toHaveURL(/\/login/);

            const menu = await openMenu(page, layout);
            await expect(menu.getByRole('link').first()).toBeVisible();
            await expect(menu.getByText('Statutory events', { exact: true })).toHaveCount(0);
            await expect(menu.getByRole('button', { name: 'Statutory listing' })).toHaveCount(0);
        });
    });
});
