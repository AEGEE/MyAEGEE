// The shared helpers other real-stack specs build on (support/core-data.ts, the mail helpers in
// support/api.ts), each used the way a spec would: what they create works across the services,
// and their cleanup leaves nothing behind.
import type { Envelope } from '../support/api.ts';
import { test, expect, expectStatus, mailLink } from '../support/api.ts';
import type { TestUsername } from '../support/constants.ts';
import { PASSWORD } from '../support/constants.ts';
import { asAdmin, createCampaign, createCircle, grantPermission } from '../support/core-data.ts';

test.describe('shared real-stack helpers', () => {
    test('a campaign: someone signs up and confirms with the link from the mail', async ({ api, page, otherAntenna }) => {
        const [campaign, removeCampaign] = await createCampaign(api, { autojoinBody: otherAntenna.body.id });
        const username: TestUsername = `e2e-signup-${Date.now()}`;
        const email = `${username}@example.com`;
        let userId = 0;

        try {
            const signup = await api.call<Envelope<{ id: number }>>(null, 'POST', `/api/core/signup/${campaign.url}`, {
                username,
                email,
                password: PASSWORD,
                first_name: 'New',
                last_name: 'Member',
                privacy_consent: new Date()
            });
            expectStatus(signup, 200);
            userId = signup.body.data.id;

            // Core mailed the token; the link in the mail opens the page with the token filled in.
            const mail = await api.waitForMail({ to: email, template: 'confirm_email.html' });
            await page.goto(mailLink(mail));
            await expect(page.getByRole('textbox')).toHaveValue(String(mail.parameters.token));
            await page.getByRole('button', { name: 'Confirm your email' }).click();
            await expect(page).toHaveURL('/login');

            // Confirmed members can log in, and the campaign made them a member of its body.
            const me = await api.me(username);
            expect(me.bodies.map((body) => body.id)).toEqual([otherAntenna.body.id]);
        } finally {
            await removeCampaign();
        }

        expectStatus(await api.call('admin', 'GET', `/api/core/campaigns/${campaign.id}`), 404);
        expectStatus(await api.call('admin', 'GET', `/api/core/members/${userId}`), 404);
    });

    test('a mail without a page of its own has no link', async ({ api, otherAntenna }) => {
        // The antenna's member signed up through a campaign too, so their confirmation mail is there.
        const confirmation = await api.waitForMail({ to: otherAntenna.member.email, template: 'confirm_email.html' });
        expect(mailLink(confirmation)).toMatch(/^\/confirm_signup\?token=.+/);
        expect(() => mailLink({ ...confirmation, template: 'network_board_welcome.html' })).toThrow(/has no link/);
    });

    test('a global permission counts in another service, until the cleanup', async ({ api }) => {
        // Members can't list the boards in network (core/scripts/seed-permissions.js).
        expectStatus(await api.call('member', 'GET', '/api/network/boards'), 403);

        const [, revoke] = await grantPermission(api, 'member', 'global:view:board');
        try {
            expectStatus(await api.call('member', 'GET', '/api/network/boards'), 200);
        } finally {
            await revoke();
        }

        expectStatus(await api.call('member', 'GET', '/api/network/boards'), 403);
    });

    test('a local permission counts in its body only', async ({ api, otherAntenna }) => {
        const { body, member } = otherAntenna;
        const seededBody = (await api.me('member')).bodies[0];
        const permissionsIn = async (bodyId: number): Promise<string[]> => {
            const res = await api.call<Envelope<{ combined: string }[]>>(member.username, 'GET', `/api/core/bodies/${bodyId}/my_permissions`);
            expectStatus(res, 200);
            return res.body.data.map((permission) => permission.combined);
        };
        const update = () => api.call(member.username, 'PUT', `/api/core/bodies/${body.id}`, { description: 'Changed by its own member' });

        await expect(grantPermission(api, member.username, 'local:update:body')).rejects.toThrow(/needs the bodyId/);
        expectStatus(await update(), 403);

        const [circle, revoke] = await grantPermission(api, member.username, 'local:update:body', { bodyId: body.id });
        try {
            expect(circle.body_id).toBe(body.id);
            expectStatus(await update(), 200);
            expect(await permissionsIn(body.id)).toContain('local:update:body');
            expect(await permissionsIn(seededBody.id)).not.toContain('local:update:body');
        } finally {
            await revoke();
        }

        expectStatus(await update(), 403);
    });

    test('circles: a free one for anyone, a bound one for members of its body', async ({ api, otherAntenna }) => {
        const seededMember = await api.me('member');
        const [free, removeFree] = await createCircle(api);
        const [bound, removeBound] = await createCircle(api, { bodyId: otherAntenna.body.id });

        try {
            expect(free.body_id).toBeNull();
            expect(bound.body_id).toBe(otherAntenna.body.id);

            await asAdmin(api, 'POST', `/circles/${free.id}/members`, { user_id: seededMember.id });
            await asAdmin(api, 'POST', `/circles/${bound.id}/members`, { user_id: otherAntenna.member.id });
            expectStatus(await api.call('admin', 'POST', `/api/core/circles/${bound.id}/members`, { user_id: seededMember.id }), 403);
        } finally {
            await removeFree();
            await removeBound();
        }

        expectStatus(await api.call('admin', 'GET', `/api/core/circles/${free.id}`), 404);
        expectStatus(await api.call('admin', 'GET', `/api/core/circles/${bound.id}`), 404);
    });
});
