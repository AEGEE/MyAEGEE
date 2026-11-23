const PermissionManager = require('../../lib/permissions-manager');

// A tree of circles:
//   1
//   ├── 2
//   │   ├── 4
//   │   │   └── 6
//   │   └── 5
//   └── 3
//   7 (on its own)
const CIRCLES = [
    { id: 1, parent_circle_id: null },
    { id: 2, parent_circle_id: 1 },
    { id: 3, parent_circle_id: 1 },
    { id: 4, parent_circle_id: 2 },
    { id: 5, parent_circle_id: 2 },
    { id: 6, parent_circle_id: 4 },
    { id: 7, parent_circle_id: null }
];

// What the manager reads of a permission: its scope, action and object in one text, and its filters.
const permission = (combined, filters = []) => ({ combined, filters });

describe('Permission manager', () => {
    let manager;

    beforeEach(() => {
        manager = new PermissionManager({ user: { id: 1 } });
        manager.addCircles(CIRCLES);
    });

    describe('getIndirectChildCircles', () => {
        test('should return every circle below the circle once', () => {
            const children = manager.getIndirectChildCircles(1);

            expect([...children].sort()).toEqual([2, 3, 4, 5, 6]);
        });

        test('should return the circles below a circle in the middle of the tree', () => {
            expect([...manager.getIndirectChildCircles(2)].sort()).toEqual([4, 5, 6]);
        });

        test('should return nothing for a circle without child circles', () => {
            expect(manager.getIndirectChildCircles(6)).toEqual([]);
            expect(manager.getIndirectChildCircles(7)).toEqual([]);
        });
    });

    describe('getIndirectParentCircles', () => {
        test('should return the circle and every circle above it', () => {
            expect(manager.getIndirectParentCircles(6)).toEqual([6, 4, 2, 1]);
            expect(manager.getIndirectParentCircles(7)).toEqual([7]);
        });
    });

    describe('addCircles', () => {
        test('should keep a circle that is added twice once', () => {
            manager.addCircles([{ id: 1, parent_circle_id: null }, { id: 8, parent_circle_id: 7 }]);

            expect(manager.circles.length).toEqual(8);
            expect(manager.getIndirectChildCircles(7)).toEqual([8]);
        });

        test('should keep the circle that was added first', () => {
            const first = manager.circlesMap[1];

            manager.addCircles([{ id: 1, parent_circle_id: 7 }]);

            expect(manager.circlesMap[1]).toBe(first);
            expect(manager.getIndirectParentCircles(1)).toEqual([1]);
        });
    });

    describe('addPermissions', () => {
        test('should add the permissions, by their scope, action and object', () => {
            const global = permission('global:view:member');
            const local = permission('local:view:member');

            manager.addPermissions([global, local]);

            expect(manager.permissions).toEqual([global, local]);
            expect(manager.permissionsMap).toEqual({
                'global:view:member': global,
                'local:view:member': local
            });
        });

        test('should keep a permission that is added twice once, as it was added first', () => {
            const first = permission('local:update:body', ['name']);
            const second = permission('local:update:body', ['email']);

            manager.addPermissions([first]);
            manager.addPermissions([second, permission('local:view:body')]);

            expect(manager.permissions.map((item) => item.combined)).toEqual(['local:update:body', 'local:view:body']);
            expect(manager.permissionsMap['local:update:body']).toBe(first);
        });
    });

    describe('getPermissionKeys', () => {
        test('should give a permission without a scope in every scope: global, local, join request', () => {
            expect(PermissionManager.getPermissionKeys('view:member')).toEqual([
                'global:view:member',
                'local:view:member',
                'join_request:view:member'
            ]);
        });

        test('should give a permission with a scope as it is', () => {
            expect(PermissionManager.getPermissionKeys('global:view:member')).toEqual(['global:view:member']);
            expect(PermissionManager.getPermissionKeys('local:view:member')).toEqual(['local:view:member']);
            expect(PermissionManager.getPermissionKeys('join_request:view:member')).toEqual(['join_request:view:member']);
        });
    });

    describe('hasPermission', () => {
        test('should not find a permission if there are none', () => {
            expect(manager.hasPermission('view:member')).toEqual(false);
            expect(manager.hasPermission('global:view:member')).toEqual(false);
        });

        test.each([
            ['global'],
            ['local'],
            ['join_request']
        ])('should find a permission without a scope if there is a %s one', (scope) => {
            manager.addPermissions([permission(scope + ':view:member')]);

            expect(manager.hasPermission('view:member')).toEqual(true);
        });

        test('should find a permission with a scope only in that scope', () => {
            manager.addPermissions([permission('local:view:member')]);

            expect(manager.hasPermission('local:view:member')).toEqual(true);
            expect(manager.hasPermission('global:view:member')).toEqual(false);
            expect(manager.hasPermission('join_request:view:member')).toEqual(false);
        });

        test('should not find a permission for another action or another object', () => {
            manager.addPermissions([permission('global:view:member')]);

            expect(manager.hasPermission('update:member')).toEqual(false);
            expect(manager.hasPermission('view:body')).toEqual(false);
            expect(manager.hasPermission('global:view:body')).toEqual(false);
        });
    });

    describe('getPermissionFilters', () => {
        test('should give nothing if there is no such permission', () => {
            manager.addPermissions([permission('local:view:body', ['name'])]);

            expect(manager.getPermissionFilters('update:body')).toBeUndefined();
            expect(manager.getPermissionFilters('global:view:body')).toBeUndefined();
        });

        test('should give the filters of the permission', () => {
            manager.addPermissions([permission('local:update:body', ['name', 'email'])]);

            expect(manager.getPermissionFilters('update:body')).toEqual(['name', 'email']);
            expect(manager.getPermissionFilters('local:update:body')).toEqual(['name', 'email']);
        });

        test('should give nothing for a permission without filters', () => {
            manager.addPermissions([permission('local:update:body', [])]);

            expect(manager.getPermissionFilters('update:body')).toBeUndefined();
        });

        test('should give the filters of the global permission before those of the local one', () => {
            manager.addPermissions([
                permission('join_request:update:body', ['phone']),
                permission('local:update:body', ['email']),
                permission('global:update:body', ['name'])
            ]);

            expect(manager.getPermissionFilters('update:body')).toEqual(['name']);
        });

        test('should give the filters of the local permission before those of the join request one', () => {
            manager.addPermissions([
                permission('join_request:update:body', ['phone']),
                permission('local:update:body', ['email'])
            ]);

            expect(manager.getPermissionFilters('update:body')).toEqual(['email']);
        });

        test('should give the filters of the join request permission if there is no other', () => {
            manager.addPermissions([permission('join_request:update:body', ['phone'])]);

            expect(manager.getPermissionFilters('update:body')).toEqual(['phone']);
        });

        test('should not look further if the first permission found has no filters', () => {
            manager.addPermissions([
                permission('global:update:body', []),
                permission('local:update:body', ['email'])
            ]);

            expect(manager.getPermissionFilters('update:body')).toBeUndefined();
        });

        test('should give the filters of the asked scope for a permission with a scope', () => {
            manager.addPermissions([
                permission('global:update:body', ['name']),
                permission('local:update:body', ['email'])
            ]);

            expect(manager.getPermissionFilters('local:update:body')).toEqual(['email']);
        });
    });
});
