// Checks the builders of factories/core-circles.ts (what the circle and permission pages get)
// against the real answers. See tests/core-contract.spec.ts for how the comparison works.
import type { Api, Envelope } from '../support/api.ts';
import { test, expect, expectStatus } from '../support/api.ts';
import { expectShape } from '../support/contract.ts';
import { asAdmin, createCircle, fillAntenna, type Circle, type Cleanup } from '../support/core-data.ts';
import { body, circle, permission } from '../ui/support/factories/core.ts';
import { circleDetail, circleMembership, circlePermission, permissionDetail, permissionHolder } from '../ui/support/factories/core-circles.ts';
import { memberListItem } from '../ui/support/factories/core-members.ts';

type Row = Record<string, unknown>;

// A circle with every optional field filled: bound to a body, with a parent and a mailing list.
const FILLED_CIRCLE = circle({ body_id: 1, parent_circle_id: 1, gsuite_id: 'circle@example.com' });
// A body with every optional field filled.
const FILLED_BODY = body({ task_description: 'x', abbreviation: 'x', phone: 'x', fee_currency: 'EUR', country: 'x', website: 'https://www.example.org', shadow_circle_id: 1 });

interface Tree {
    grandparent: Circle;
    parent: Circle;
    circle: Circle;
    child: Circle;
    permission: { id: number; combined: string };
}

// Circles bound to the antenna, each with a mailing list: grandparent (free) > parent > circle >
// child, a permission made for the test with a filter, attached to the circle only, and the
// antenna's member in the circle with a position.
const buildTree = async (api: Api, antennaId: number, memberId: number): Promise<[Tree, Cleanup]> => {
    const cleanups: Cleanup[] = [];
    const cleanup = async () => { for (const step of cleanups.reverse()) await step(); };
    try {
        const add = async (bodyId?: number): Promise<Circle> => {
            const [made, remove] = await createCircle(api, { bodyId });
            cleanups.push(remove);
            await asAdmin(api, 'PUT', `/circles/${made.id}`, { gsuite_id: `e2e-circle-${made.id}@example.com` });
            return made;
        };
        const grandparent = await add();
        const parent = await add(antennaId);
        const middle = await add(antennaId);
        const child = await add(antennaId);
        await asAdmin(api, 'PUT', `/circles/${parent.id}/parent`, { parent_circle_id: grandparent.id });
        await asAdmin(api, 'PUT', `/circles/${middle.id}/parent`, { parent_circle_id: parent.id });
        await asAdmin(api, 'PUT', `/circles/${child.id}/parent`, { parent_circle_id: middle.id });

        const made = await asAdmin<{ id: number; combined: string }>(api, 'POST', '/permissions', {
            scope: 'global', action: 'e2e', object: `contract-${middle.id}`, description: 'Made by a contract test', filters: ['name']
        });
        cleanups.push(async () => { await asAdmin(api, 'DELETE', `/permissions/${made.id}`); });
        await asAdmin(api, 'POST', `/circles/${middle.id}/permissions`, { permission_id: made.id });

        // One the parent gives, so the circle inherits something too.
        const [given] = await asAdmin<{ id: number; combined: string }[]>(api, 'GET', '/permissions?query=global:view:member');
        await asAdmin(api, 'POST', `/circles/${parent.id}/permissions`, { permission_id: given.id });

        const membership = await asAdmin<{ id: number }>(api, 'POST', `/circles/${middle.id}/members`, { user_id: memberId });
        await asAdmin(api, 'PUT', `/circles/${middle.id}/members/${membership.id}`, { position: 'Treasurer' });

        return [{ grandparent, parent, circle: middle, child, permission: made }, cleanup];
    } catch (err) {
        await cleanup();
        throw err;
    }
};

test.describe('circle and permission page factories match the real API', () => {
    test('a circle, its permissions and its members', async ({ api, otherAntenna }) => {
        await fillAntenna(api, otherAntenna, { otherBodyId: (await api.me('member')).bodies[0].id });
        const [tree, cleanup] = await buildTree(api, otherAntenna.body.id, otherAntenna.member.id);
        try {
            const shown = await asAdmin<Row>(api, 'GET', `/circles/${tree.circle.id}`);
            expectShape('circleDetail', circleDetail({
                ...FILLED_CIRCLE,
                body: FILLED_BODY,
                parent_circle: FILLED_CIRCLE,
                child_circles: [FILLED_CIRCLE],
                permissions: [{ ...permission('global:e2e:thing'), filters: ['name'] }]
            }), shown);

            // Every permission of the circle, with the circles that give it: its own and its parents'.
            const all = await api.call<Envelope<Row[]>>('admin', 'GET', `/api/core/circles/${tree.circle.id}/permissions`);
            expectStatus(all, 200);
            const own = all.body.data.find((row) => row.id === tree.permission.id);
            expectShape('circlePermission', circlePermission('global:e2e:thing', { filters: ['name'] }), own);
            const givers = (row: Row | undefined) => (row?.circle_permissions as { circle_id: number }[]).map((link) => link.circle_id);
            expect(givers(own)).toEqual([tree.circle.id]);
            expect(givers(all.body.data.find((row) => row.combined === 'global:view:member'))).toEqual([tree.parent.id]);

            const members = await api.call<Envelope<Row[]>>('admin', 'GET', `/api/core/circles/${tree.circle.id}/members`);
            expectStatus(members, 200);
            expect(members.body.data).toHaveLength(1);
            expectShape('circleMembership', circleMembership({
                position: 'Treasurer',
                user: memberListItem({ about_me: 'x', image: 'picture.png', gsuite_id: 'example-x@aegee.eu', campaign_id: 1 })
            }), members.body.data[0]);
            expect(members.body.meta).toEqual({ count: 1 });
        } finally {
            await cleanup();
        }
    });

    test('a permission and the members who have it', async ({ api, otherAntenna }) => {
        await fillAntenna(api, otherAntenna, { otherBodyId: (await api.me('member')).bodies[0].id });
        const [tree, cleanup] = await buildTree(api, otherAntenna.body.id, otherAntenna.member.id);
        try {
            const shown = await asAdmin<Row>(api, 'GET', `/permissions/${tree.permission.id}`);
            expectShape('permissionDetail', permissionDetail('global:e2e:thing', { filters: ['name'], circles: [FILLED_CIRCLE] }), shown);

            const holders = await api.call<Envelope<Row[]>>('admin', 'GET', `/api/core/permissions/${tree.permission.id}/members`);
            expectStatus(holders, 200);
            const member = holders.body.data.find((row) => row.id === otherAntenna.member.id);
            const holder = permissionHolder({ about_me: 'x', image: 'picture.png', gsuite_id: 'example-x@aegee.eu', campaign_id: 1 });
            expectShape('permissionHolder', {
                ...holder,
                circle_memberships: [{ ...holder.circle_memberships[0], position: 'Treasurer' }],
                circles: [FILLED_CIRCLE]
            }, member, {
                ignore: { '$.circles[0].gsuite_id': 'which of the member\'s circles comes first is up to the database; circleDetail compares a circle with a mailing list' }
            });
            // The member has it through the circle it is attached to.
            expect((member?.circle_memberships as { circle_id: number }[]).map((link) => link.circle_id)).toContain(tree.circle.id);
        } finally {
            await cleanup();
        }
    });
});
