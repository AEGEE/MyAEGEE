// The Antenna Criteria page reads five services: the bodies and the Network Commission from
// core, the Agorae, members lists and statutory events from statutory, the European events
// from events, the Summer Universities from summeruniversity, and the boards, NetCom
// assignments and values set by hand from network. This checks that a NetCommie gets a
// criterion worked out from a real board, and that a value set in the editor is stored.
// How the page shows each case is covered by the mocked-API specs in ui/network/.
import { test, expect, expectStatus, loginInBrowser } from '../support/api.ts';
import type { Envelope } from '../support/api.ts';
import { createBoard, createPublishedAgora, day } from '../support/network-data.ts';
import { cellOf, dialog, tableRows, toast } from '../ui/support/shell.ts';

test.describe('the Antenna Criteria check', () => {
    test('a NetCommie sees the board election of a Local from its board, and a value set by hand is kept', async ({ page, api, otherAntenna }) => {
        const { body } = otherAntenna;
        const agora = await createPublishedAgora(api, { name: `E2E Agora ${Date.now()}` });
        const [, cleanup] = await createBoard(api, otherAntenna, { elected_date: day(-30) });

        try {
            await loginInBrowser(page, api, 'netcom');
            await page.goto('/network/ac_check');
            const check = page.getByRole('article', { name: 'Antenna Criteria Check' });
            const table = check.getByRole('table');
            const row = tableRows(table).filter({ hasText: body.name });

            await page.getByLabel('Selected Agora').selectOption({ label: agora.name });
            await expect(check).not.toHaveAttribute('aria-busy');
            await expect(row).toHaveCount(1);
            // Elected a month ago, less than a year before the Agora ends.
            await expect(await cellOf(table, row, 'BE')).toHaveText('Yes');
            await expect(await cellOf(table, row, 'C')).toHaveText('Empty');
            await expect(await cellOf(table, row, 'Status')).toHaveText('Danger');

            await check.getByRole('button', { name: `Edit criteria for ${body.name}` }).click();
            const editor = dialog(page, `Criteria for ${body.name}`);
            await editor.getByLabel('Communication (C)').selectOption('Yes');
            await editor.getByLabel('Communication comment').fill('Answers every mail');
            await editor.getByRole('button', { name: 'Save' }).click();
            await expect(toast(page, 'Antenna Criteria fulfilment updated.')).toBeVisible();

            await page.reload();
            await page.getByLabel('Selected Agora').selectOption({ label: agora.name });
            await expect(check).not.toHaveAttribute('aria-busy');
            await expect(await cellOf(table, row, 'C')).toHaveText('Yes');
            await check.getByRole('button', { name: `Show comments for ${body.name}` }).click();
            await expect(dialog(page, `Comments for ${body.name}`)).toContainText('Communication: Answers every mail');

            const stored = await api.call<Envelope<Record<string, unknown>[]>>('netcom', 'GET', `/api/network/antennaCriteria/${agora.id}`);
            expectStatus(stored, 200);
            expect(stored.body.data.filter((criterion) => criterion.body_id === body.id)).toEqual([
                expect.objectContaining({ agora_id: agora.id, body_id: body.id, antenna_criterion: 'communication', value: 'true', comment: 'Answers every mail' })
            ]);
        } finally {
            await cleanup();
        }
    });
});
