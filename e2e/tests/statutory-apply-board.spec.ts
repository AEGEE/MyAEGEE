// The way of an application to an Agora against the real services: core's permissions decide
// who is on the board of an antenna; a member of the antenna applies, the board gives the
// application a place, and who manages the applications accepts it. The detailed behaviour of
// each page is covered by the mocked-API suite in ui/statutory/.
import type { Envelope } from '../support/api.ts';
import { test, expect, expectStatus, loginInBrowser } from '../support/api.ts';
import { completeProfile, makeBoardMember } from '../support/statutory-applications-data.ts';
import { cellOf, tableRows, toast } from '../ui/support/shell.ts';

test.describe('applying to an Agora', () => {
    test('a member applies, their board gives them a place and the application is accepted', async ({ api, page, otherAntenna }) => {
        const { body, member } = otherAntenna;
        const applicant = `${member.first_name} ${member.last_name}`;
        await completeProfile(api, member);
        const removeBoard = await makeBoardMember(api, 'board', body.id);
        try {
            const event = await api.createStatutoryEvent();
            expectStatus(await api.call('admin', 'PUT', `/api/statutory/events/${event.id}/status`, { status: 'published' }), 200);
            const board = await api.me('board');

            await test.step('the member applies from their antenna', async () => {
                await loginInBrowser(page, api, member.username);
                await page.goto(`/statutory/${event.url}/applications/new`);

                await expect(page.getByRole('heading', { name: `Apply to ${event.name}` })).toBeVisible();
                // The default limit of an antenna lets it send delegates and visitors.
                await expect(page.getByRole('combobox', { name: /^Body/ }).getByRole('option')).toHaveText([body.name]);
                await page.getByRole('combobox', { name: /^Nationality/ }).selectOption('Belgian');
                await page.getByRole('combobox', { name: /^Meals type/ }).selectOption('Vegan');
                await page.getByRole('textbox', { name: /^Why do you want to come\?/ }).fill('To vote for my antenna');
                await page.getByRole('button', { name: 'Save application!' }).click();

                await expect(toast(page, 'Application is saved.')).toBeVisible();
                await expect(page).toHaveURL(new RegExp(`/statutory/${event.url}/applications/\\d+$`));
                await expect(page.getByText('Your application is recorded, please wait for the organisers to evaluate your application.')).toBeVisible();

                // The member and the board of the antenna are told.
                await api.waitForMail({ to: member.email, template: 'statutory_applied.html' });
                await api.waitForMail({ to: board.email, template: 'statutory_board_applied.html' });
            });

            await test.step('the board of the antenna gives the application delegate 1', async () => {
                await loginInBrowser(page, api, 'board');
                await page.goto(`/statutory/${event.url}/boardview`);
                // The places of the antenna are there once its limits are.
                const limits = page.waitForResponse((response) => response.url().endsWith(`/api/statutory/limits/agora/${body.id}`));
                await page.getByRole('combobox', { name: 'Select the body to view application from:' }).selectOption(body.name);
                await limits;

                await expect(page.getByRole('listitem').filter({ hasText: /^3 delegates$/ })).toBeVisible();
                await expect(page.getByRole('tab', { name: 'Edit boardview' })).toHaveAttribute('aria-selected', 'true');
                await page.getByRole('combobox', { name: 'User for delegate 1', exact: true }).selectOption({ label: applicant });
                await page.getByRole('textbox', { name: 'Board comment for delegate 1', exact: true }).fill('Our most active member');
                await page.getByRole('button', { name: 'Save!' }).click();

                await expect(toast(page, 'Participants info is successfully updated.')).toBeVisible();
                await page.getByRole('tab', { name: 'View applications' }).click();
                const table = page.getByRole('tabpanel', { name: 'View applications' }).getByRole('table');
                await expect(await cellOf(table, tableRows(table).filter({ hasText: applicant }), 'Participant type and order')).toHaveText('delegate (1)');
            });

            await test.step('who manages the applications accepts it', async () => {
                await loginInBrowser(page, api, 'admin');
                await page.goto(`/statutory/${event.url}/applications`);

                const table = page.getByRole('region', { name: 'Applications' }).getByRole('table');
                const row = tableRows(table).filter({ hasText: member.last_name });
                await expect(await cellOf(table, row, 'Body')).toHaveText(body.name);
                await expect(await cellOf(table, row, 'Participant type')).toHaveText('delegate (1)');
                await expect(await cellOf(table, row, 'Board comment')).toHaveText('Our most active member');
                await page.getByRole('combobox', { name: `Status of ${applicant}` }).selectOption('Accepted');

                await expect(toast(page, `Successfully updated status of application for user #${member.id} to "accepted"`)).toBeVisible();
            });

            await test.step('the member doesn\'t see the status before the participants list is out', async () => {
                const mine = await api.call<Envelope<{ status: string; participant_type: string }>>(member.username, 'GET', `/api/statutory/events/${event.id}/applications/me`);
                expectStatus(mine, 200);
                expect(mine.body.data).toMatchObject({ status: 'pending', participant_type: 'delegate' });

                await loginInBrowser(page, api, member.username);
                await page.goto(`/statutory/${event.url}/applications/me`);
                await expect(page.getByText('Your application is recorded, please wait for the organisers to evaluate your application.')).toBeVisible();
                await expect(page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Participant type', exact: true }) }).getByRole('cell')).toHaveText('delegate');
            });
        } finally {
            await removeBoard();
        }
    });
});
