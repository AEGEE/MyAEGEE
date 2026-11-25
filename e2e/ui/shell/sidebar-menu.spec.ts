// The sidebar menu: which sections and entries a visitor, a member and a superadmin get, where
// they lead, and that the group of the page that is shown is open.
import type { Locator, Page } from '@playwright/test';

import { ok } from '../support/factories/base.ts';
import { permission } from '../support/factories/core.ts';
import { openMenu } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { test, expect } from '../support/test.ts';

// A section of the menu: the list of links under its heading.
const section = (menu: Locator, name: string): Locator => menu.getByRole('list', { name, exact: true });

const openGroup = async (menu: Locator, name: string): Promise<void> => {
    const group = menu.getByRole('button', { name, exact: true });
    await group.click();
    await expect(group).toHaveAttribute('aria-expanded', 'true');
};

const headings = (menu: Locator): Promise<string[]> => menu.getByRole('heading').allTextContents().then((texts) => texts.map((text) => text.trim()));

// A page outside the groups of the menu, so every group starts closed.
const openAboutPage = async (page: Page): Promise<void> => {
    await page.goto('/about');
    await expect(page).toHaveTitle('MyAEGEE | About MyAEGEE');
};

test.describe('sidebar menu', () => {
    test.describe('anonymously', () => {
        test.use({ session: 'anonymous' });

        test('a visitor gets the public pages and the way to log in or sign up', async ({ page, layout }) => {
            await openAboutPage(page);
            const menu = await openMenu(page, layout);

            expect(await headings(menu)).toEqual(['Authorization', 'General', 'Core', 'Events', 'Summer University']);
            await expect(section(menu, 'Authorization').getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
            await expect(section(menu, 'Authorization').getByRole('link', { name: 'Register' })).toHaveAttribute('href', '/signup/default');
            await expect(section(menu, 'General').getByRole('link')).toHaveText(['Events calendar']);
            await expect(section(menu, 'General').getByRole('link', { name: 'Events calendar' })).toHaveAttribute('href', '/calendar');
            await expect(section(menu, 'Core').getByRole('link')).toHaveText(['Bodies']);
            await expect(section(menu, 'Events').getByRole('button')).toHaveText(['Events listing']);
            await expect(section(menu, 'Summer University').getByRole('button')).toHaveText(['SU listing']);

            await openGroup(menu, 'Events listing');
            await expect(section(menu, 'Events').getByRole('link')).toHaveText(['All events']);
            await openGroup(menu, 'SU listing');
            await expect(section(menu, 'Summer University').getByRole('link')).toHaveText(['All Summer Universities']);
        });
    });

    test.describe('as a member without any permission', () => {
        test.beforeEach(({ myPermissions }) => {
            myPermissions.length = 0;
        });

        test('a member gets the pages for everyone and no way to log in again', async ({ page, layout }) => {
            await openAboutPage(page);
            const menu = await openMenu(page, layout);

            expect(await headings(menu)).toEqual(['General', 'My Development', 'Core', 'Events', 'Summer University', 'Statutory events', 'Resources']);
            await expect(menu.getByRole('link', { name: 'Login' })).toHaveCount(0);
            await expect(section(menu, 'General').getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard');
            await expect(section(menu, 'Core').getByRole('link')).toHaveText(['Bodies']);
            // The admin groups have no entry left for this member, so they are gone.
            await expect(section(menu, 'Events').getByRole('button')).toHaveText(['Events listing']);
            await expect(section(menu, 'Summer University').getByRole('button')).toHaveText(['SU listing']);
            await expect(section(menu, 'Statutory events').getByRole('button')).toHaveText(['Statutory listing']);
            await expect(section(menu, 'Statutory events').getByRole('link')).toHaveCount(0);

            await openGroup(menu, 'Events listing');
            await expect(section(menu, 'Events').getByRole('link', { name: 'Participating' })).toHaveAttribute('href', '/events/participating');
            await expect(section(menu, 'Events').getByRole('link', { name: 'Organising' })).toHaveAttribute('href', '/events/organizing');
            await expect(section(menu, 'Events').getByRole('link', { name: 'Create event' })).toHaveCount(0);
        });

        test('pages on other sites open in a new tab', async ({ page, layout }) => {
            await openAboutPage(page);
            const menu = await openMenu(page, layout);

            for (const [name, href] of [
                ['Open Calls', /^https:\/\/forms\.gle\//],
                ['Interest form', /^https:\/\/docs\.google\.com\/forms\//],
                ['Helpdesk', /^https:\/\/myaegee\.atlassian\.net\//],
                ['Ideas Platform', /^https:\/\/aegee\.kollaboratio\.eu/]
            ] as const) {
                const link = menu.getByRole('link', { name });
                await expect(link).toHaveAttribute('href', href);
                await expect(link).toHaveAttribute('target', '_blank');
                await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
            }
        });

        test('the resources section leads to the discounts, the resources and the knowledge base', async ({ page, layout }) => {
            await openAboutPage(page);
            const menu = await openMenu(page, layout);
            const resources = section(menu, 'Resources');

            await expect(resources.getByRole('link', { name: 'Discounts' })).toHaveAttribute('href', '/discounts');
            await expect(resources.getByRole('link', { name: 'Resources' })).toHaveAttribute('href', '/resources');
            await expect(resources.getByRole('link', { name: 'KMS' })).toHaveAttribute('href', '/pages/kms');
        });
    });

    test.describe('as a superadmin', () => {
        test.use({ session: 'superadmin' });

        test('every entry that needs a permission is there', async ({ page, layout }) => {
            await openAboutPage(page);
            const menu = await openMenu(page, layout);

            expect(await headings(menu)).toEqual(['General', 'My Development', 'Core', 'Events', 'Summer University', 'Statutory events', 'Network', 'Resources', 'For admins']);
            const core = section(menu, 'Core');
            for (const [name, href] of [['Members', '/members'], ['Bodies', '/bodies'], ['Permissions', '/permissions'], ['Circles', '/circles'], ['Campaigns', '/campaigns']]) {
                await expect(core.getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
            }

            const groups: [string, string, [string, string][]][] = [
                ['Events', 'Events admin', [['Change event status', '/events/change_status'], ['Board view', '/events/boardview']]],
                ['Events', 'Events listing', [['Create event', '/events/new']]],
                ['Summer University', 'Events admin', [['Change SU status', '/summeruniversity/change_status'], ['Board view', '/summeruniversity/boardview'], ['Seasons', '/summeruniversity/seasons'], ['Statistics', '/summeruniversity/stats']]],
                ['Summer University', 'SU listing', [['Create SU', '/summeruniversity/new']]],
                ['Statutory events', 'Statutory listing', [['Create event', '/statutory/new']]]
            ];
            for (const [category, group, entries] of groups) {
                await openGroup(section(menu, category), group);
                for (const [name, href] of entries) {
                    await expect(section(menu, category).getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
                }
            }

            for (const [category, name, href] of [
                ['Statutory events', 'Participants types amount', '/statutory/limits'],
                ['Statutory events', 'Background tasks', '/statutory/tasks'],
                ['Network', 'Boards listing', '/network/boards'],
                ['Network', 'AC check', '/network/ac_check'],
                ['For admins', 'Status', '/status'],
                ['For admins', 'Unconfirmed users', '/members/unconfirmed']
            ]) {
                await expect(section(menu, category).getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
            }
        });
    });

    test.describe('a member with one of the permissions an entry lists', () => {
        test('gets "Change event status" with only the permission to approve trainings', async ({ page, layout, myPermissions }) => {
            myPermissions.splice(0, myPermissions.length, permission('global:approve_event:training'));
            await openAboutPage(page);
            const menu = await openMenu(page, layout);

            const events = section(menu, 'Events');
            await openGroup(events, 'Events admin');
            await expect(events.getByRole('link', { name: 'Change event status', exact: true })).toHaveAttribute('href', '/events/change_status');
            await expect(events.getByRole('link', { name: 'Board view', exact: true })).toHaveCount(0);
        });

        test('gets "Permissions" with only the permission to create permissions', async ({ page, layout, myPermissions }) => {
            myPermissions.splice(0, myPermissions.length, permission('global:create:permission'));
            await openAboutPage(page);
            const menu = await openMenu(page, layout);

            await expect(section(menu, 'Core').getByRole('link', { name: 'Permissions', exact: true })).toHaveAttribute('href', '/permissions');
            await expect(section(menu, 'Core').getByRole('link', { name: 'Circles', exact: true })).toHaveCount(0);
        });
    });

    test('the group of the page that is shown is open', async ({ page, api, layout }) => {
        api.json('GET events /', ok([]));
        api.json('GET events /mine/participating', ok([]));
        await page.goto('/events/participating');
        await expect(page).toHaveTitle('MyAEGEE | List events I\'m participating at');

        let menu = await openMenu(page, layout);
        await expect(menu.getByRole('button', { name: 'Events listing' })).toHaveAttribute('aria-expanded', 'true');
        // The Summer University group has a "Participating" entry too, closed.
        await expect(section(menu, 'Events').getByRole('link', { name: 'Participating', exact: true })).toBeVisible();
        await expect(menu.getByRole('button', { name: 'SU listing' })).toHaveAttribute('aria-expanded', 'false');

        // Another page of the same group: it stays open.
        await menu.getByRole('link', { name: 'All events' }).click();
        await expect(page).toHaveURL('/events');
        menu = await openMenu(page, layout);
        await expect(menu.getByRole('button', { name: 'Events listing' })).toHaveAttribute('aria-expanded', 'true');

        // Going to a page of another group opens that one too.
        api.fallback(mockEverything);
        await page.goto('/summeruniversity');
        await expect(page).toHaveTitle(/^MyAEGEE \| /);
        menu = await openMenu(page, layout);
        await expect(menu.getByRole('button', { name: 'SU listing' })).toHaveAttribute('aria-expanded', 'true');
    });
});
