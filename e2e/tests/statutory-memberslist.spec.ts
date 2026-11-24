// The members list of an Agora against the real services: the board of an antenna fetches its
// members and their current fees from core and sends the list, the Network Director sees it
// among the members lists and sets the fee paid, the antenna's votes follow from it, and the
// antenna is no longer among the locals without a list. The detailed behaviour of each page is
// covered by the mocked-API suite in ui/statutory/.
//
// Saving a members list makes statutory ask the currency conversion rates. Statutory takes their
// host from CONVERSION_RATE_API_HOST, the stand-in of support/fake-currency.ts, once statutory
// PR #2405 is merged; until then this flow depends on the European Commission's server.
import { test, expect, expectStatus, loginInBrowser } from '../support/api.ts';
import { asAdmin, grantPermission, type Cleanup } from '../support/core-data.ts';

const day = (offset: number): string => new Date(Date.now() + offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

test.describe('the members list of an Agora', () => {
    test('a board sends its members list, the Network Director sets the fee paid, and the votes follow', async ({ api, page, otherAntenna }) => {
        const { body, member } = otherAntenna;
        const cleanups: Cleanup[] = [];
        try {
            // The board of the antenna: its members list for Agorae, and its members and payments in core.
            for (const permission of ['local:manage_memberslist:agora', 'local:view_members:body', 'local:view:payment']) {
                cleanups.push((await grantPermission(api, member.username, permission, { bodyId: body.id }))[1]);
            }
            // The member paid 40 euro to the antenna this year.
            await asAdmin(api, 'POST', `/bodies/${body.id}/payments`, { user_id: member.id, starts: day(-30), expires: day(300), amount: 40, currency: 'EUR' });
            const event = await api.createStatutoryEvent();
            expectStatus(await api.call('admin', 'PUT', `/api/statutory/events/${event.id}/status`, { status: 'published' }), 200);

            await test.step('the board fetches its members from core and sends the list', async () => {
                await loginInBrowser(page, api, member.username);
                await page.goto(`/statutory/${event.url}/memberslist/upload`);
                await expect(page.getByLabel('Select the body to manage members list for:').getByRole('option', { name: body.name })).toBeAttached();
                await expect(page.getByText('This local hasn\'t submitted a members list for this event yet.')).toBeVisible();

                await page.getByRole('button', { name: 'Fetch members list from a body' }).click();
                const row = page.getByRole('table', { name: 'Members' }).getByRole('row').filter({ hasText: member.last_name });
                // The fee comes from the member's payment.
                await expect(row.getByRole('cell').nth(4)).toHaveText('40');
                await page.getByLabel('Currency').selectOption('Euro');
                await page.getByRole('button', { name: 'Save!', exact: true }).click();

                await expect(page.getByRole('alert').filter({ hasText: 'Members list is uploaded.' })).toBeVisible();
                // 12.5% of 30 euro and 5% of the 10 above.
                await expect(page.getByText('Total fee paid to AEGEE-Europe: 4.25 EUR')).toBeVisible();
            });

            await test.step('the Network Director sets the fee paid', async () => {
                await loginInBrowser(page, api, 'nd');
                await page.goto(`/statutory/${event.url}/memberslist/list`);
                const row = page.getByRole('region', { name: 'Members lists' }).getByRole('row').filter({ hasText: body.name });
                await expect(row).toContainText('4.25 EUR');

                await page.getByRole('button', { name: `Set fee paid of ${body.name}` }).click();
                const prompt = page.getByRole('alertdialog', { name: 'Set fee paid' });
                await prompt.getByRole('spinbutton', { name: 'Fee paid (in EUR)' }).fill('4.25');
                await prompt.getByRole('button', { name: 'OK' }).click();

                await expect(page.getByRole('alert').filter({ hasText: 'Fee paid is set.' })).toBeVisible();
                await page.reload();
                await expect(row.getByRole('cell').nth(6)).toHaveText('4.25 EUR');
                await expect(row.getByRole('cell').nth(7)).toHaveText('0.00 EUR');
            });

            await test.step('the antenna has a vote, which every member sees', async () => {
                await loginInBrowser(page, api, 'member');
                await page.goto(`/statutory/${event.url}/votes`);
                const row = page.getByRole('table', { name: 'By antenna' }).getByRole('row').filter({ hasText: body.name });
                // One vote for up to 20 members.
                await expect(row.getByRole('cell').nth(2)).toHaveText('1');
            });

            await test.step('the antenna is no longer among the locals without a list', async () => {
                await loginInBrowser(page, api, 'nd');
                await page.goto(`/statutory/${event.url}/memberslist/list/missing`);
                const missing = page.getByRole('region', { name: 'Missing members lists' });
                // The seeded antenna sent none.
                await expect(missing.getByRole('row').nth(1)).toBeVisible();
                await expect(missing.getByRole('link', { name: body.name })).toHaveCount(0);
            });
        } finally {
            for (const cleanup of cleanups.reverse()) await cleanup();
        }
    });
});
