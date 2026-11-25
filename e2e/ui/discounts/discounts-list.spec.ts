// The discounts page (/discounts): the partner discounts of AEGEE by category, each a card that
// opens its long description, and the way to the member's codes and, for discounts managers,
// to managing them. Members only.
import { ok } from '../support/factories/base.ts';
import { permission } from '../support/factories/core.ts';
import { discount, discountCategory } from '../support/factories/discounts.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

const CATEGORIES = [
    discountCategory({
        id: 1,
        name: 'Travel',
        discounts: [
            discount({ name: 'Flixbus', icon: 'bus', shortDescription: '10% off every ride', longDescription: 'Book on **flixbus.com** and type the code at checkout.' }),
            discount({ name: 'Hostelworld', icon: 'bed', shortDescription: 'No booking fee', longDescription: 'Valid for *every* hostel.' })
        ]
    }),
    discountCategory({
        id: 2,
        name: 'Food',
        discounts: [discount({ name: 'Pizza Place', icon: 'utensils', shortDescription: 'A free drink', longDescription: 'Show your AEGEE card.' })]
    })
];

test.describe('discounts page', () => {
    test('lists the categories with their discounts; a card opens and closes its description', async ({ page, api }) => {
        api.json('GET discounts /categories', ok(CATEGORIES));

        await page.goto('/discounts');

        const main = page.getByRole('main');
        await expect(main.getByRole('heading', { level: 2 })).toHaveText(['Travel', 'Food']);
        const travel = main.getByRole('region', { name: 'Travel' });
        await expect(travel.getByRole('button')).toHaveText([/Flixbus:\s*10% off every ride/, /Hostelworld:\s*No booking fee/]);
        await expect(main.getByRole('region', { name: 'Food' }).getByRole('button')).toHaveText([/Pizza Place:\s*A free drink/]);

        const flixbus = travel.getByRole('button', { name: /^Flixbus/ });
        const description = page.getByText('and type the code at checkout.');
        await expect(description).toBeHidden();

        await flixbus.click();
        await expect(description).toBeVisible();
        await expect(travel.getByRole('strong')).toHaveText('flixbus.com');
        // Only this card opened.
        await expect(page.getByText('Valid for')).toBeHidden();

        await flixbus.click();
        await expect(description).toBeHidden();
        expect(api.callsTo('GET discounts /categories')).toHaveLength(1);
    });

    test('the cards are buttons that say whether they are open, and open with the keyboard', async ({ page, api }) => {
        api.json('GET discounts /categories', ok(CATEGORIES));
        await page.goto('/discounts');

        const hostelworld = page.getByRole('region', { name: 'Travel' }).getByRole('button', { name: /^Hostelworld/ });
        await expect(hostelworld).toHaveAttribute('aria-expanded', 'false');
        const controlled = await hostelworld.getAttribute('aria-controls');
        expect(controlled).toBeTruthy();

        await hostelworld.focus();
        await page.keyboard.press('Enter');
        await expect(hostelworld).toHaveAttribute('aria-expanded', 'true');
        await expect(page.getByRole('emphasis')).toHaveText('every');
        // The description is the element the button points to.
        await expect(page.getByText('Valid for')).toBeVisible();
        expect(await page.getByText('Valid for').evaluate((element, id) => Boolean(element.closest(`#${id}`)), controlled)).toBe(true);

        await page.keyboard.press('Space');
        await expect(hostelworld).toHaveAttribute('aria-expanded', 'false');
        await expect(page.getByText('Valid for')).toBeHidden();
    });

    test('a member gets the way to their codes only', async ({ page, api }) => {
        api.json('GET discounts /categories', ok(CATEGORIES));

        await page.goto('/discounts');

        await expect(page.getByRole('heading', { name: 'Travel' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'My codes' })).toHaveAttribute('href', '/discounts/my');
        await expect(page.getByRole('link', { name: 'Manage discounts' })).toHaveCount(0);
        await expect(page.getByRole('link', { name: 'Manage codes' })).toHaveCount(0);
    });

    test('a discounts manager also gets the ways to manage them, from the permissions of the session', async ({ page, api, myPermissions }) => {
        myPermissions.push(permission('global:manage:discounts'));
        api.json('GET discounts /categories', ok(CATEGORIES));

        await page.goto('/discounts');

        await expect(page.getByRole('link', { name: 'Manage discounts' })).toHaveAttribute('href', '/discounts/categories');
        await expect(page.getByRole('link', { name: 'Manage codes' })).toHaveAttribute('href', '/discounts/integrations');
        // The app asked for the permissions once, when it started; the page didn't ask again.
        expect(api.callsTo('GET core /my_permissions')).toHaveLength(1);

        api.fallback(mockEverything);
        await page.getByRole('link', { name: 'My codes' }).click();
        await expect(page).toHaveURL(/\/discounts\/my$/);
    });

    test('without categories there are only the links', async ({ page, api }) => {
        api.json('GET discounts /categories', ok([]));

        await page.goto('/discounts');

        await expect(page.getByRole('link', { name: 'My codes' })).toBeVisible();
        await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveCount(0);
        await expect(page.getByRole('main').getByRole('button')).toHaveCount(0);
    });

    test('says so when the categories cannot be loaded', async ({ page, api }) => {
        api.on('GET discounts /categories', { status: 500, json: { success: false, message: 'Database is down' } });

        await page.goto('/discounts');

        await expect(toast(page, 'Could not fetch categories list: Database is down')).toBeVisible();
        await expect(page.getByRole('link', { name: 'My codes' })).toBeVisible();
    });
});
