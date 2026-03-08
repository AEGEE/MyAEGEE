const PermissionsManager = require('../../lib/permissions-manager');
const { Sequelize } = require('../../lib/sequelize');
const { CirclePermission, Circle } = require('../../models');

describe('PermissionsManager', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('expands unscoped permissions by priority order', () => {
        expect(PermissionsManager.getPermissionKeys('edit:user')).toEqual([
            'global:edit:user',
            'local:edit:user',
            'join_request:edit:user'
        ]);

        expect(PermissionsManager.getPermissionKeys('global:edit:user')).toEqual(['global:edit:user']);
    });

    test('prefers global filters over lower-scope permissions', () => {
        const manager = new PermissionsManager({ user: { id: 1 } });

        manager.addPermissions([
            { combined: 'join_request:edit:user', filters: [{ body_id: 3 }] },
            { combined: 'local:edit:user', filters: [{ body_id: 2 }] },
            { combined: 'global:edit:user', filters: [{ body_id: 1 }] }
        ]);

        expect(manager.hasPermission('edit:user')).toEqual(true);
        expect(manager.getPermissionFilters('edit:user')).toEqual([{ body_id: 1 }]);
    });

    test('returns nested child circles recursively', () => {
        const manager = new PermissionsManager({ user: { id: 1 } });
        manager.addCircles([
            { id: 1, parent_circle_id: null },
            { id: 2, parent_circle_id: 1 },
            { id: 3, parent_circle_id: 2 },
            { id: 4, parent_circle_id: 1 }
        ]);

        expect(manager.getIndirectChildCircles(1).sort()).toEqual([2, 3, 4]);
        expect(manager.getIndirectChildCircles(2)).toEqual([3]);
    });

    test('returns parent circle chain including the current circle', () => {
        const manager = new PermissionsManager({ user: { id: 1 } });
        manager.addCircles([
            { id: 1, parent_circle_id: null },
            { id: 2, parent_circle_id: 1 },
            { id: 3, parent_circle_id: 2 }
        ]);

        expect(manager.getIndirectParentCircles(3)).toEqual([3, 2, 1]);
    });

    test('fetches permission circles including inherited child circles', async () => {
        const manager = new PermissionsManager({ user: { id: 1 } });
        manager.addCircles([
            { id: 10, parent_circle_id: null },
            { id: 11, parent_circle_id: 10 },
            { id: 12, parent_circle_id: 11 }
        ]);

        jest.spyOn(CirclePermission, 'findAll').mockResolvedValue([
            { circle_id: 10 },
            { circle_id: 11 }
        ]);
        jest.spyOn(Circle, 'findAll').mockResolvedValue([
            { id: 10 },
            { id: 11 },
            { id: 12 }
        ]);

        const circles = await manager.fetchPermissionCircles({ id: 99 });

        expect(CirclePermission.findAll).toHaveBeenCalledWith({ where: { permission_id: 99 } });
        expect(Circle.findAll).toHaveBeenCalledWith({
            where: {
                id: {
                    [Sequelize.Op.in]: [11, 12, 12, 10, 11]
                }
            }
        });
        expect(circles).toEqual([{ id: 10 }, { id: 11 }, { id: 12 }]);
    });
});
