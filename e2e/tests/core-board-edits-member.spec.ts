// What a board may do with its own antenna, against the real core: the permissions it holds in
// the antenna (`GET /bodies/:id/my_permissions`) let it edit a member of the antenna, but not
// delete them, and edit the antenna's description. How the pages behave in detail is in the
// mocked-API suite (ui/core/).
import { test, expect, loginInBrowser } from '../support/api.ts';
import { USERS } from '../support/constants.ts';
import { asAdmin } from '../support/core-data.ts';
import { toast } from '../ui/support/shell.ts';

interface Person {
    id: number;
    phone: string | null;
}

interface Antenna {
    id: number;
    name: string;
    description: string;
}

test.describe('a board and the members of its antenna', () => {
    test('the board edits a member of its antenna and the antenna\'s description', async ({ api, page }) => {
        const seeded = await api.me('member');
        const antennaId = seeded.bodies[0].id;
        const member = await asAdmin<Person>(api, 'GET', `/members/${seeded.id}`);
        const antenna = await asAdmin<Antenna>(api, 'GET', `/bodies/${antennaId}`);
        const suffix = Date.now().toString().slice(-6);
        const phone = `+32 000 ${suffix}`;
        const description = `Edited by its board ${suffix}`;

        try {
            await loginInBrowser(page, api, 'board');
            await page.goto(`/members/${seeded.id}`);
            await expect(page.getByRole('link', { name: 'Edit profile' })).toBeVisible();
            await expect(page.getByRole('button', { name: 'Delete profile' })).toHaveCount(0);
            await page.getByRole('link', { name: 'Edit profile' }).click();
            // The form is filled in once the member is loaded.
            await expect(page.getByLabel('Username', { exact: true })).toHaveValue(USERS.member);
            await page.getByLabel('Phone', { exact: true }).fill(phone);
            await page.getByRole('button', { name: 'Save user' }).click();
            await expect(toast(page, 'User is saved.')).toBeVisible();
            expect((await asAdmin<Person>(api, 'GET', `/members/${seeded.id}`)).phone).toBe(phone);

            await page.goto(`/bodies/${antennaId}/edit`);
            await expect(page.getByRole('textbox', { name: /^Name/ })).toHaveValue(antenna.name);
            await page.getByRole('textbox', { name: /^Description/ }).fill(description);
            await page.getByRole('button', { name: 'Save body' }).click();
            await expect(toast(page, 'Body is saved.')).toBeVisible();
            const saved = await asAdmin<Antenna>(api, 'GET', `/bodies/${antennaId}`);
            expect(saved.description).toBe(description);
            // The board may only change the description; the rest of the form went unchanged.
            expect(saved.name).toBe(antenna.name);
        } finally {
            await asAdmin(api, 'PUT', `/members/${seeded.id}`, { phone: member.phone });
            await asAdmin(api, 'PUT', `/bodies/${antennaId}`, { description: antenna.description });
        }
    });
});
