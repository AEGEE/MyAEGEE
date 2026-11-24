// Joining a body through a join request, against the real core: the member asks on the page of
// the body, an admin approves on the body's join requests page, and the member is then in the
// body, in its members list, and holds the permissions of the body's members through its shadow
// circle. How the pages behave in detail is in the mocked-API suite (ui/core/).
import type { Envelope } from '../support/api.ts';
import { test, expect, expectStatus, loginInBrowser } from '../support/api.ts';
import { asAdmin } from '../support/core-data.ts';
import { dialog, tableRows, toast } from '../ui/support/shell.ts';

type Row = Record<string, unknown>;

test.describe('joining a body', () => {
    test('a member asks to join, an admin approves, and the member is in the body', async ({ api, page, otherAntenna }) => {
        const { body } = otherAntenna;
        const { shadow_circle_id: shadowCircleId, code } = await asAdmin<{ shadow_circle_id: number; code: string }>(api, 'GET', `/bodies/${body.id}`);
        const member = await api.me('member');
        const name = `${member.first_name} ${member.last_name}`;
        // The circles through which the member may see the members of a body.
        const viewMembersCircles = async (): Promise<unknown[]> => {
            const res = await api.call<Envelope<Row[]>>('member', 'POST', '/api/core/my_permissions', { action: 'view_members', object: 'body' });
            expectStatus(res, 200);
            return res.body.data.map((circle) => circle.id);
        };
        expect(await viewMembersCircles()).not.toContain(shadowCircleId);

        await loginInBrowser(page, api, 'member');
        await page.goto(`/bodies/${body.id}`);
        await page.getByRole('button', { name: 'Ask to join body' }).click();
        const prompt = dialog(page, 'Join body');
        await prompt.getByRole('textbox', { name: 'Motivation' }).fill('I moved to this city');
        await prompt.getByRole('button', { name: 'OK' }).click();
        await expect(toast(page, 'Join request is sent.')).toBeVisible();
        await expect(page.getByText('Join request sent')).toBeVisible();

        await loginInBrowser(page, api, 'admin');
        await page.goto(`/bodies/${body.id}/join_requests`);
        const request = tableRows(page.getByRole('table')).filter({ hasText: name });
        await expect(request).toContainText('I moved to this city');
        await request.getByRole('button', { name: 'Approve' }).click();
        await dialog(page, `Approve ${name}`).getByRole('button', { name: `Approve ${name}` }).click();
        await expect(toast(page, 'Join request is approved.')).toBeVisible();
        await expect(request.getByRole('button')).toHaveCount(0);

        await loginInBrowser(page, api, 'member');
        await page.goto('/members/me');
        await expect(page.getByRole('heading', { name: 'Bodies' })).toBeVisible();
        await expect(page.getByRole('row').filter({ has: page.getByRole('link', { name: code, exact: true }) })).toContainText(body.name);
        // Through the body they are in its shadow circle.
        await expect(page.getByRole('link', { name: `Members ${body.name}` })).toHaveAttribute('href', `/circles/${shadowCircleId}`);
        // As a member of the body, they may now see its members.
        await page.goto(`/bodies/${body.id}/members`);
        await expect(tableRows(page.getByRole('table')).filter({ hasText: name })).toBeVisible();

        // The body's shadow circle gives its members the permissions of the general members circle.
        expect(await viewMembersCircles()).toContain(shadowCircleId);
        const inBody = await api.call<Envelope<{ combined: string }[]>>('member', 'GET', `/api/core/bodies/${body.id}/my_permissions`);
        expectStatus(inBody, 200);
        expect(inBody.body.data.map((permission) => permission.combined)).toContain('local:view_members:body');
        const global = await api.call<Envelope<{ combined: string }[]>>('member', 'GET', '/api/core/my_permissions');
        expectStatus(global, 200);
        expect(global.body.data.map((permission) => permission.combined)).toContain('global:create:event');
    });
});
