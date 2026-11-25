// Managing the resources page (/resources/manage): its sections and their links, in order.
// Every member can open it; only holders of `global:manage:resources` get the actions, and core
// checks that permission again on every change.
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

import { forbidden, ok, unprocessable } from '../support/factories/base.ts';
import { permission, type Permission } from '../support/factories/core.ts';
import { resourceCategory, resourceLink, type ResourceCategory } from '../support/factories/static.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { dialog, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const manage = (page: Page) => page.getByRole('region', { name: 'Manage resources', exact: true });
const section = (page: Page, name: string) => manage(page).getByRole('region', { name, exact: true });

const NEWSLETTER = resourceLink({ id: 11, category_id: 1, title: 'AEGEE Newsletter', description: 'News from the network, every month.', url: 'https://www.aegee.org/newsletter/' });
const LISTS = resourceLink({ id: 12, category_id: 1, title: 'Mailing Lists', description: 'Which lists there are and how to join them.', url: '/pages/mailing-lists', position: 1 });
const GUIDELINES = resourceLink({ id: 21, category_id: 2, title: 'Financial guidelines', description: 'How the money of AEGEE is handled.', url: 'https://www.aegee.org/financial-guidelines/' });

const STAY_INFORMED = resourceCategory({ id: 1, name: 'Stay informed', theme: 'blue', links: [NEWSLETTER, LISTS] });
const FINANCIAL = resourceCategory({ id: 2, name: 'Financial', theme: 'yellow', position: 1, links: [GUIDELINES] });
const TEMPLATES = resourceCategory({ id: 3, name: 'Templates', theme: 'green', position: 2, links: [] });
const SECTIONS = [STAY_INFORMED, FINANCIAL, TEMPLATES];

const mayManage = (myPermissions: Permission[]): void => {
    myPermissions.push(permission('global:manage:resources'));
};

// Holds an answer back until the test lets it through.
const held = () => {
    let release = (): void => {};
    const until = new Promise<void>((resolve) => { release = resolve; });
    return { until, release };
};

test.describe('managing the resources page', () => {
    test('a member without the permission sees the sections, but no actions', async ({ page, api }) => {
        api.json('GET core /resources', ok(SECTIONS));

        await page.goto('/resources/manage');

        await expect(manage(page).getByText('You need the global:manage:resources permission to change the Resources page.')).toBeVisible();
        await expect(manage(page).getByRole('heading', { level: 2 })).toHaveText(['Stay informed', 'Financial', 'Templates']);
        await expect(section(page, 'Stay informed').getByRole('listitem')).toHaveCount(2);
        await expect(manage(page).getByRole('link', { name: 'View the Resources page' })).toHaveAttribute('href', '/resources');
        await expect(manage(page).getByRole('button')).toHaveCount(0);
        await expect(manage(page).getByRole('link')).toHaveCount(1);
        await expect(manage(page).getByText('Changes show on the Resources page straight away.')).toHaveCount(0);
        expect(api.callsTo('GET core /resources')).toHaveLength(1);
    });

    test('a manager gets the actions, and those that can\'t be used are off', async ({ page, api, myPermissions }) => {
        mayManage(myPermissions);
        api.json('GET core /resources', ok(SECTIONS));

        await page.goto('/resources/manage');

        await expect(manage(page).getByText('Changes show on the Resources page straight away. A section can only be deleted once it has no links.')).toBeVisible();
        await expect(manage(page).getByText('You need the global:manage:resources permission')).toHaveCount(0);
        await expect(manage(page).getByRole('link', { name: 'Add section' })).toHaveAttribute('href', '/resources/categories/new');

        const first = section(page, 'Stay informed');
        await expect(first.getByRole('button', { name: 'Move section Stay informed up' })).toBeDisabled();
        await expect(first.getByRole('button', { name: 'Move section Stay informed down' })).toBeEnabled();
        await expect(first.getByRole('link', { name: 'Edit section Stay informed' })).toHaveAttribute('href', '/resources/categories/1/edit');
        const deleteFirst = first.getByRole('button', { name: 'Delete section Stay informed' });
        await expect(deleteFirst).toBeDisabled();
        await expect(deleteFirst).toHaveAccessibleDescription('Move or delete its links first');
        await expect(first.getByRole('link', { name: 'Add link to Stay informed' })).toHaveAttribute('href', '/resources/links/new?category_id=1');

        const middle = section(page, 'Financial');
        await expect(middle.getByRole('button', { name: 'Move section Financial up' })).toBeEnabled();
        await expect(middle.getByRole('button', { name: 'Move section Financial down' })).toBeEnabled();

        const last = section(page, 'Templates');
        await expect(last.getByRole('button', { name: 'Move section Templates up' })).toBeEnabled();
        await expect(last.getByRole('button', { name: 'Move section Templates down' })).toBeDisabled();
        const deleteLast = last.getByRole('button', { name: 'Delete section Templates' });
        await expect(deleteLast).toBeEnabled();
        await expect(deleteLast).toHaveAccessibleDescription('');

        await expect(first.getByRole('button', { name: 'Move link AEGEE Newsletter up' })).toBeDisabled();
        await expect(first.getByRole('button', { name: 'Move link AEGEE Newsletter down' })).toBeEnabled();
        await expect(first.getByRole('button', { name: 'Move link Mailing Lists up' })).toBeEnabled();
        await expect(first.getByRole('button', { name: 'Move link Mailing Lists down' })).toBeDisabled();
        await expect(first.getByRole('link', { name: 'Edit link Mailing Lists' })).toHaveAttribute('href', '/resources/links/12/edit');
        await expect(first.getByRole('button', { name: 'Delete link Mailing Lists' })).toBeEnabled();
        // The only link of a section can't move either way.
        await expect(middle.getByRole('button', { name: 'Move link Financial guidelines up' })).toBeDisabled();
        await expect(middle.getByRole('button', { name: 'Move link Financial guidelines down' })).toBeDisabled();
    });

    test('links show their address, pages of MyAEGEE marked; a section without links says so', async ({ page, api }) => {
        api.json('GET core /resources', ok(SECTIONS));

        await page.goto('/resources/manage');

        const links = section(page, 'Stay informed').getByRole('listitem');
        await expect(links).toHaveText([
            /^AEGEE Newsletter\s*News from the network, every month\.\s*https:\/\/www\.aegee\.org\/newsletter\/\s*$/,
            /^Mailing Lists\s*Which lists there are and how to join them\.\s*MyAEGEE\s*\/pages\/mailing-lists\s*$/
        ]);
        await expect(section(page, 'Financial').getByText('MyAEGEE')).toHaveCount(0);
        await expect(section(page, 'Templates').getByText('This section has no links yet.')).toBeVisible();
        await expect(section(page, 'Templates').getByRole('listitem')).toHaveCount(0);

        // The page fades in: axe reads the colours once that is over.
        await expect(async () => {
            const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
            expect(results.violations).toEqual([]);
        }).toPass({ timeout: 5000 });
    });

    test('moving a section down sends the new order and shows the page as core has it then', async ({ page, api, myPermissions }) => {
        mayManage(myPermissions);
        let sections: ResourceCategory[] = SECTIONS;
        api.on('GET core /resources', () => ({ json: ok(sections) }));
        api.on('PUT core /resources/categories/order', () => {
            sections = [FINANCIAL, STAY_INFORMED, TEMPLATES];
            return { json: ok(sections) };
        });

        await page.goto('/resources/manage');
        await section(page, 'Stay informed').getByRole('button', { name: 'Move section Stay informed down' }).click();

        await expect(manage(page).getByRole('heading', { level: 2 })).toHaveText(['Financial', 'Stay informed', 'Templates']);
        expect(api.callsTo('PUT core /resources/categories/order').map((call) => call.body)).toEqual([{ ids: [2, 1, 3] }]);
        expect(api.callsTo('GET core /resources')).toHaveLength(2);
        await expect(section(page, 'Stay informed').getByRole('button', { name: 'Move section Stay informed up' })).toBeEnabled();
        await expect(section(page, 'Financial').getByRole('button', { name: 'Move section Financial up' })).toBeDisabled();
        // Moving says nothing: the page shows the new order.
        await expect(page.getByRole('alert')).toHaveCount(0);
    });

    test('moving a link up sends the new order of its section', async ({ page, api, myPermissions }) => {
        mayManage(myPermissions);
        let sections: ResourceCategory[] = SECTIONS;
        api.on('GET core /resources', () => ({ json: ok(sections) }));
        api.on('PUT core /resources/categories/:id/links/order', () => {
            sections = [{ ...STAY_INFORMED, links: [LISTS, NEWSLETTER] }, FINANCIAL, TEMPLATES];
            return { json: ok(sections[0]) };
        });

        await page.goto('/resources/manage');
        const stayInformed = section(page, 'Stay informed');
        await stayInformed.getByRole('button', { name: 'Move link Mailing Lists up' }).click();

        await expect(stayInformed.getByRole('listitem')).toHaveText([/^Mailing Lists/, /^AEGEE Newsletter/]);
        expect(api.callsTo('PUT core /resources/categories/:id/links/order').map((call) => [call.params, call.body]))
            .toEqual([[{ id: '1' }, { ids: [12, 11] }]]);
        await expect(stayInformed.getByRole('button', { name: 'Move link Mailing Lists up' })).toBeDisabled();
        await expect(page.getByRole('alert')).toHaveCount(0);
    });

    test('deleting a section asks first, and sends nothing when cancelled', async ({ page, api, myPermissions }) => {
        mayManage(myPermissions);
        let sections: ResourceCategory[] = SECTIONS;
        api.on('GET core /resources', () => ({ json: ok(sections) }));
        api.on('DELETE core /resources/categories/:id', () => {
            sections = [STAY_INFORMED, FINANCIAL];
            return { json: { success: true, message: 'Section is deleted.' } };
        });

        await page.goto('/resources/manage');
        const remove = section(page, 'Templates').getByRole('button', { name: 'Delete section Templates' });

        await remove.click();
        const ask = dialog(page, 'Delete a section');
        await expect(ask).toContainText('Are you sure you want to delete this section? This action cannot be undone.');
        await ask.getByRole('button', { name: 'Cancel' }).click();
        await expect(ask).toBeHidden();
        expect(api.callsTo('DELETE core /resources/categories/:id')).toEqual([]);
        expect(api.callsTo('GET core /resources')).toHaveLength(1);

        await remove.click();
        await dialog(page, 'Delete a section').getByRole('button', { name: 'Delete section', exact: true }).click();

        await expect(toast(page, 'Section is deleted.')).toBeVisible();
        await expect(manage(page).getByRole('heading', { level: 2 })).toHaveText(['Stay informed', 'Financial']);
        expect(api.callsTo('DELETE core /resources/categories/:id').map((call) => call.params)).toEqual([{ id: '3' }]);
    });

    test('deleting a link asks first, then deletes it', async ({ page, api, myPermissions }) => {
        mayManage(myPermissions);
        let sections: ResourceCategory[] = SECTIONS;
        api.on('GET core /resources', () => ({ json: ok(sections) }));
        api.on('DELETE core /resources/links/:id', () => {
            sections = [STAY_INFORMED, { ...FINANCIAL, links: [] }, TEMPLATES];
            return { json: { success: true, message: 'Link is deleted.' } };
        });

        await page.goto('/resources/manage');
        const financial = section(page, 'Financial');
        await financial.getByRole('button', { name: 'Delete link Financial guidelines' }).click();
        const ask = dialog(page, 'Delete a link');
        await expect(ask).toContainText('Are you sure you want to delete this link? This action cannot be undone.');
        await ask.getByRole('button', { name: 'Delete link', exact: true }).click();

        await expect(toast(page, 'Link is deleted.')).toBeVisible();
        await expect(financial.getByText('This section has no links yet.')).toBeVisible();
        // Without links the section can be deleted now.
        await expect(financial.getByRole('button', { name: 'Delete section Financial' })).toBeEnabled();
        expect(api.callsTo('DELETE core /resources/links/:id').map((call) => call.params)).toEqual([{ id: '21' }]);
    });

    test('every action is off while a change is saved and the page loads again', async ({ page, api, myPermissions }) => {
        mayManage(myPermissions);
        const saving = held();
        const reloading = held();
        let sections: ResourceCategory[] = SECTIONS;
        let reloadAsked = false;
        api.on('GET core /resources', async () => {
            if (sections !== SECTIONS) {
                reloadAsked = true;
                await reloading.until;
            }
            return { json: ok(sections) };
        });
        api.on('PUT core /resources/categories/order', async () => {
            await saving.until;
            sections = [STAY_INFORMED, TEMPLATES, FINANCIAL];
            return { json: ok(sections) };
        });

        await page.goto('/resources/manage');
        const buttons = manage(page).getByRole('button');
        // 3 sections and 3 links, each with Move up, Move down and Delete.
        await expect(buttons).toHaveCount(18);
        await expect(manage(page)).not.toHaveAttribute('aria-busy');
        await section(page, 'Financial').getByRole('button', { name: 'Move section Financial down' }).click();

        await expect(manage(page)).toHaveAttribute('aria-busy', 'true');
        for (const index of Array.from({ length: 18 }, (_, n) => n)) {
            await expect(buttons.nth(index)).toBeDisabled();
        }
        saving.release();
        await expect.poll(() => reloadAsked).toBe(true);
        await expect(manage(page)).toHaveAttribute('aria-busy', 'true');
        await expect(section(page, 'Stay informed').getByRole('button', { name: 'Delete link Mailing Lists' })).toBeDisabled();
        reloading.release();

        await expect(manage(page).getByRole('heading', { level: 2 })).toHaveText(['Stay informed', 'Templates', 'Financial']);
        await expect(manage(page)).not.toHaveAttribute('aria-busy');
        await expect(section(page, 'Stay informed').getByRole('button', { name: 'Delete link Mailing Lists' })).toBeEnabled();
        expect(api.callsTo('PUT core /resources/categories/order').map((call) => call.body)).toEqual([{ ids: [1, 3, 2] }]);
    });

    test('a keyboard user keeps their place while moving a section or a link', async ({ page, api, myPermissions }) => {
        mayManage(myPermissions);
        const orders: Record<string, ResourceCategory[]> = {
            '1,2,3': SECTIONS,
            '2,1,3': [FINANCIAL, STAY_INFORMED, TEMPLATES],
            '2,3,1': [FINANCIAL, TEMPLATES, STAY_INFORMED]
        };
        let sections: ResourceCategory[] = SECTIONS;
        api.on('GET core /resources', () => ({ json: ok(sections) }));
        api.on('PUT core /resources/categories/order', ({ body }) => {
            sections = orders[(body as { ids: number[] }).ids.join(',')];
            return { json: ok(sections) };
        });
        api.on('PUT core /resources/categories/:id/links/order', () => {
            sections = sections.map((item) => (item.id === 1 ? { ...item, links: [LISTS, NEWSLETTER] } : item));
            return { json: ok(sections.find((item) => item.id === 1)) };
        });

        await page.goto('/resources/manage');
        const stayInformed = section(page, 'Stay informed');
        await stayInformed.getByRole('button', { name: 'Move section Stay informed down' }).focus();
        await page.keyboard.press('Enter');

        await expect(manage(page).getByRole('heading', { level: 2 })).toHaveText(['Financial', 'Stay informed', 'Templates']);
        await expect(stayInformed.getByRole('button', { name: 'Move section Stay informed down' })).toBeFocused();

        // At the end, the section can only move up.
        await page.keyboard.press('Enter');
        await expect(manage(page).getByRole('heading', { level: 2 })).toHaveText(['Financial', 'Templates', 'Stay informed']);
        await expect(stayInformed.getByRole('button', { name: 'Move section Stay informed up' })).toBeFocused();

        await stayInformed.getByRole('button', { name: 'Move link AEGEE Newsletter down' }).focus();
        await page.keyboard.press('Enter');
        await expect(stayInformed.getByRole('listitem')).toHaveText([/^Mailing Lists/, /^AEGEE Newsletter/]);
        await expect(stayInformed.getByRole('button', { name: 'Move link AEGEE Newsletter up' })).toBeFocused();

        expect(api.callsTo('PUT core /resources/categories/order').map((call) => call.body)).toEqual([{ ids: [2, 1, 3] }, { ids: [2, 3, 1] }]);
        expect(api.callsTo('PUT core /resources/categories/:id/links/order').map((call) => [call.params, call.body]))
            .toEqual([[{ id: '1' }, { ids: [12, 11] }]]);
    });

    test('a move that core refuses says why and shows the page as core has it', async ({ page, api, myPermissions }) => {
        mayManage(myPermissions);
        // Someone else deleted a section in the meantime: the page still shows it.
        let sections: ResourceCategory[] = SECTIONS;
        api.on('GET core /resources', () => {
            const answer = ok(sections);
            sections = [STAY_INFORMED, FINANCIAL];
            return { json: answer };
        });
        api.on('PUT core /resources/categories/order', {
            status: 422,
            json: unprocessable('ids should list every current item exactly once. Reload the page and try again.')
        });
        api.on('PUT core /resources/categories/:id/links/order', { status: 403, json: forbidden('Permission global:manage:resources is required, but not present.') });

        await page.goto('/resources/manage');
        await section(page, 'Templates').getByRole('button', { name: 'Move section Templates up' }).click();
        await expect(toast(page, 'Could not move the section: ids should list every current item exactly once. Reload the page and try again.')).toBeVisible();
        await expect(section(page, 'Templates')).toHaveCount(0);
        expect(api.callsTo('GET core /resources')).toHaveLength(2);

        await section(page, 'Stay informed').getByRole('button', { name: 'Move link AEGEE Newsletter down' }).click();
        await expect(toast(page, 'Could not move the link: Permission global:manage:resources is required, but not present.')).toBeVisible();
        await expect.poll(() => api.callsTo('GET core /resources').length).toBe(3);
        await expect(section(page, 'Stay informed').getByRole('button', { name: 'Move link AEGEE Newsletter down' })).toBeFocused();

        expect(api.callsTo('PUT core /resources/categories/order').map((call) => call.body)).toEqual([{ ids: [1, 3, 2] }]);
        expect(api.callsTo('PUT core /resources/categories/:id/links/order').map((call) => [call.params, call.body]))
            .toEqual([[{ id: '1' }, { ids: [12, 11] }]]);
        await expect(manage(page).getByRole('heading', { level: 2 })).toHaveText(['Stay informed', 'Financial']);
    });

    test('a delete that core refuses says why and shows the page as core has it', async ({ page, api, myPermissions }) => {
        mayManage(myPermissions);
        let sections: ResourceCategory[] = SECTIONS;
        api.on('GET core /resources', () => ({ json: ok(sections) }));
        // Someone else added a link to the section in the meantime.
        api.on('DELETE core /resources/categories/:id', () => {
            sections = [STAY_INFORMED, FINANCIAL, { ...TEMPLATES, links: [resourceLink({ id: 31, category_id: 3, title: 'Letter template' })] }];
            return { status: 409, json: { success: false, message: 'This section still has 1 link(s). Move or delete them first.' } };
        });
        api.on('DELETE core /resources/links/:id', { status: 403, json: forbidden('Permission global:manage:resources is required, but not present.') });

        await page.goto('/resources/manage');
        const templates = section(page, 'Templates');
        await templates.getByRole('button', { name: 'Delete section Templates' }).click();
        await dialog(page, 'Delete a section').getByRole('button', { name: 'Delete section', exact: true }).click();

        await expect(toast(page, 'Could not delete the section: This section still has 1 link(s). Move or delete them first.')).toBeVisible();
        await expect(templates.getByRole('listitem')).toHaveText([/^Letter template/]);
        await expect(templates.getByRole('button', { name: 'Delete section Templates' })).toBeDisabled();

        await templates.getByRole('button', { name: 'Delete link Letter template' }).click();
        await dialog(page, 'Delete a link').getByRole('button', { name: 'Delete link', exact: true }).click();
        await expect(toast(page, 'Could not delete the link: Permission global:manage:resources is required, but not present.')).toBeVisible();
        await expect.poll(() => api.callsTo('GET core /resources').length).toBe(3);
        await expect(templates.getByRole('listitem')).toHaveCount(1);

        expect(api.callsTo('DELETE core /resources/categories/:id').map((call) => call.params)).toEqual([{ id: '3' }]);
        expect(api.callsTo('DELETE core /resources/links/:id').map((call) => call.params)).toEqual([{ id: '31' }]);
    });

    test('"Add link to" a section opens the link form with that section chosen', async ({ page, api, myPermissions }) => {
        mayManage(myPermissions);
        api.json('GET core /resources', ok(SECTIONS));

        await page.goto('/resources/manage');
        await section(page, 'Financial').getByRole('link', { name: 'Add link to Financial' }).click();

        await expect(page).toHaveURL(/\/resources\/links\/new\?category_id=2$/);
        await expect(page.getByRole('heading', { name: 'Add link', exact: true })).toBeVisible();
        await expect(page.getByLabel('Section')).toHaveValue('2');
        await expect(page.getByRole('option', { name: 'Financial', selected: true })).toBeAttached();
        // The manage page and the form each ask for the sections.
        expect(api.callsTo('GET core /resources')).toHaveLength(2);
    });

    test('says so when there are no sections', async ({ page, api, myPermissions }) => {
        mayManage(myPermissions);
        api.json('GET core /resources', ok([]));

        await page.goto('/resources/manage');

        await expect(manage(page).getByText('Nothing here.')).toBeVisible();
        await expect(manage(page).getByRole('region')).toHaveCount(0);
        await expect(manage(page).getByRole('link', { name: 'Add section' })).toBeVisible();
    });

    test('says so when the sections can\'t be loaded', async ({ page, api }) => {
        api.on('GET core /resources', { status: 500, json: { success: false, message: 'Database is down' } });

        await page.goto('/resources/manage');

        await expect(toast(page, 'Could not load the resources: Database is down')).toBeVisible();
        await expect(manage(page)).not.toHaveAttribute('aria-busy');
    });

    test('is busy until the sections are in', async ({ page, api }) => {
        const loading = held();
        api.on('GET core /resources', async () => { await loading.until; return { json: ok(SECTIONS) }; });

        await page.goto('/resources/manage');

        await expect(manage(page)).toHaveAttribute('aria-busy', 'true');
        await expect(manage(page).getByText('Nothing here.')).toHaveCount(0);
        loading.release();
        await expect(manage(page)).not.toHaveAttribute('aria-busy');
        await expect(section(page, 'Templates')).toBeVisible();
    });

    test('"View the Resources page" goes back to the page members see', async ({ page, api }) => {
        api.json('GET core /resources', ok(SECTIONS));

        await page.goto('/resources/manage');
        api.fallback(mockEverything);
        await manage(page).getByRole('link', { name: 'View the Resources page' }).click();

        await expect(page).toHaveURL(/\/resources$/);
        await expect(page.getByRole('region', { name: 'Resources', exact: true })).toBeVisible();
    });
});
