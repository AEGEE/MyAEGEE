// Factories for what the circle and permission pages of core get (views/core/circles/,
// views/core/permissions/). See base.ts for the rules; the circle as the lists have it is
// `circle()` and a permission is `permission()`, both in core.ts.
import { id, iso } from './base.ts';
import { circle, permission, type Body, type Circle, type Permission } from './core.ts';
import { memberListItem, type MemberListItem } from './core-members.ts';

// One circle with what `GET core /circles/:id` includes: its body (for a bound circle), its
// parent, its children and the permissions attached to it directly. Pass `body` for a bound
// circle; `body_id` follows it.
export interface CircleDetail extends Circle {
    body: Body | null;
    parent_circle: Circle | null;
    child_circles: Circle[];
    permissions: Permission[];
}

export const circleDetail = (overrides: Partial<CircleDetail> = {}): CircleDetail => {
    const base = circle({ id: overrides.id ?? id(), name: 'Network Commission', description: 'Supports the antennae of a region' });
    const bound = overrides.body ?? null;
    return {
        ...base,
        body_id: bound?.id ?? overrides.body_id ?? null,
        parent_circle_id: overrides.parent_circle?.id ?? overrides.parent_circle_id ?? null,
        body: bound,
        parent_circle: null,
        child_circles: [],
        permissions: [],
        ...overrides
    };
};

// Which circle gives a circle a permission: the circle itself or one of its parents.
export interface CirclePermissionLink {
    circle_id: number;
    permission_id: number;
    created_at: string;
    updated_at: string;
}

// A row of `GET core /circles/:id/permissions`: every permission the circle has, the ones
// attached to it and the ones it inherits from its parents, each with the circles that give it
// (`circle_permissions`, only the circle and its parents).
export interface CirclePermission extends Permission {
    circle_permissions: CirclePermissionLink[];
}

export const circlePermission = (combined: string, overrides: Partial<CirclePermission> & { from?: number[] } = {}): CirclePermission => {
    const { from = [1], ...rest } = overrides;
    const base = permission(combined);
    const permissionId = rest.id ?? base.id;
    return {
        ...base,
        id: permissionId,
        circle_permissions: from.map((circleId) => ({ circle_id: circleId, permission_id: permissionId, created_at: iso(-100), updated_at: iso(-100) })),
        ...rest
    };
};

// A row of `GET core /circles/:id/members`: the membership with the member's own fields.
export interface CircleMembership {
    id: number;
    circle_id: number;
    user_id: number;
    position: string | null;
    user: MemberListItem;
    created_at: string;
    updated_at: string;
}

export const circleMembership = (overrides: Partial<CircleMembership> = {}): CircleMembership => {
    const user = overrides.user ?? memberListItem(overrides.user_id === undefined ? {} : { id: overrides.user_id });
    return {
        id: id(),
        circle_id: 1,
        position: null,
        created_at: iso(-60),
        updated_at: iso(-60),
        ...overrides,
        user,
        user_id: user.id
    };
};

// One permission with what `GET core /permissions/:id` includes: the circles it is attached to.
export interface PermissionDetail extends Permission {
    circles: Circle[];
    created_at: string;
    updated_at: string;
}

export const permissionDetail = (combined: string, overrides: Partial<PermissionDetail> = {}): PermissionDetail => ({
    ...permission(combined),
    circles: [],
    created_at: iso(-500),
    updated_at: iso(-30),
    ...overrides
});

// A row of `GET core /permissions/:id/members`: a member who has the permission, through one of
// their circles (or as a superadmin), with those memberships and all their circles.
export interface PermissionHolder extends MemberListItem {
    circle_memberships: Omit<CircleMembership, 'user'>[];
    circles: Circle[];
}

export const permissionHolder = (overrides: Partial<PermissionHolder> = {}): PermissionHolder => {
    const user = memberListItem(overrides.id === undefined ? {} : { id: overrides.id });
    const through = circle({ name: 'Board AEGEE-Antenna', body_id: 1 });
    return {
        ...user,
        circle_memberships: [{ id: id(), circle_id: through.id, user_id: user.id, position: null, created_at: iso(-60), updated_at: iso(-60) }],
        circles: [through],
        ...overrides
    };
};
