import type { Locator, Page } from '@playwright/test';
import { test, expect, loginInBrowser, moveToModule } from '../support/api.ts';

type CellCheck = (cell: Locator) => Promise<void>;

const hasText = (text: string | number): CellCheck => (cell) => expect(cell).toHaveText(String(text));
const hasSelect: CellCheck = (cell) => expect(cell.locator('select')).toBeVisible();

// Checks that the first row's cell under each header has that column's content, and then
// that the table shows exactly `columns`, in this order.
const expectColumns = async (page: Page, columns: [string, CellCheck][]): Promise<void> => {
    const table = page.locator('table');
    const headers = table.locator('thead th');
    const cells = table.locator('tbody tr').first().locator('td');
    await expect(headers).toHaveCount(columns.length);
    await expect(cells).toHaveCount(columns.length);

    const checks = new Map(columns);
    const labels = (await headers.allTextContents()).map((label) => label.trim());
    for (const [index, label] of labels.entries()) {
        const check = checks.get(label);
        expect(check, `unexpected column "${label}"`).toBeDefined();
        await test.step(`cell under "${label}"`, () => check!(cells.nth(index)));
    }

    expect(labels).toEqual(columns.map(([label]) => label));
};

test.describe('statutory manage applications', () => {
    // Buefy's b-table-column is renderless, so with v-if on a column Vue could pair the
    // columns after it with other column components once the event loaded: the headers
    // updated but the cells kept the old content, e.g. "View" under "Confirmed?".
    test('cells stay under their own headers', moveToModule('frontend', 'once the frontend has component tests'), async ({ api, page }) => {
        const event = await api.createStatutoryEvent();
        const application = await api.applyToStatutory('member', event);
        const [question] = event.questions;

        await loginInBrowser(page, api, 'admin');
        await page.goto(`/statutory/${event.url}/applications`);
        await expect(page.locator('table tbody tr').first()).toContainText(application.body_name);

        const leading: [string, CellCheck][] = [
            ['#', hasText(application.statutory_id)],
            ['User ID', hasText(application.user_id)],
            ['Body', hasText(application.body_name)],
            ['Is on memberslist?', hasText('No')],
            ['Was on previous memberslist?', hasText('No')],
            ['First name', hasText('A')],
            ['Last name', hasText('Member')],
            // The board hasn't set these yet.
            ['Participant type', hasText('')],
            ['Board comment', hasText('')]
        ];
        const trailing: [string, CellCheck][] = [
            ['Confirmed?', hasText('No')],
            ['Attended?', hasText('No')],
            ['Manage status', hasSelect],
            ['View', hasText('View')],
            ['Edit', hasText('Edit')]
        ];

        await test.step('after the event loads', () => expectColumns(page, [...leading, ...trailing]));

        await test.step('after adding the question column', async () => {
            await page.getByText('fields selected').click();
            await page.locator('.multiselect__option').filter({ hasText: question.description }).click();
            await page.getByText('Manage applications', { exact: true }).click();

            await expectColumns(page, [...leading, [question.description, hasText('Created by the e2e tests')], ...trailing]);
        });

        await test.step('after showing cancelled applications', async () => {
            await page.getByRole('button', { name: 'Display all applications' }).click();

            await expectColumns(page, [
                ...leading,
                [question.description, hasText('Created by the e2e tests')],
                ['Cancelled?', hasText('No')],
                ...trailing
            ]);
        });
    });
});
