const { CircleMembership, CirclePermission, Permission, Body, Circle } = require('../models');
const helpers = require('./helpers');
const { Sequelize } = require('./sequelize');

class PermissionsManager {
    constructor(params) {
        this.user = params.user;

        this.permissions = [];
        this.permissionsMap = {};

        this.circles = [];
        this.circlesMap = {};
    }

    // istanbul ignore next
    addCircles(circles) {
        for (const circle of circles) {
            if (!this.circlesMap[circle.id]) {
                this.circles.push(circle);
                this.circlesMap[circle.id] = circle;
            }
        }
    }

    // istanbul ignore next
    addPermissions(permissions) {
        for (const permission of permissions) {
            if (!this.permissionsMap[permission.combined]) {
                this.permissions.push(permission);
                this.permissionsMap[permission.combined] = permission;
            }
        }
    }

    // This function should be called with a string, which is the `combined` field
    // of a permission, either with a scope (like `global:edit:user`) or without it
    // (like `edit:user`). If scope is provided, only permission with scope is searched
    // for, if it's not provided, all scopes are iterated through, with the following
    // priority: global, local, join_request (so if a person has both `global:edit:user` and
    // `local:edit:user` permissions, the first one would be chosen.
    static getPermissionKeys(combined) {
        const combinedSplit = combined.split(':');
        if (combinedSplit.length === 2) {
            return [
                'global:' + combined,
                'local:' + combined,
                'join_request:' + combined,
            ];
        }

        return [combined];
    }

    hasPermission(permission) {
        const keys = PermissionsManager.getPermissionKeys(permission);
        return keys.some((key) => this.permissionsMap[key]);
    }

    getPermissionFilters(permission) {
        const keys = PermissionsManager.getPermissionKeys(permission);
        for (const key of keys) {
            if (this.permissionsMap[key]) {
                return this.permissionsMap[key].filters.length > 0 ? this.permissionsMap[key].filters : undefined;
            }
        }
    }

    getIndirectChildCircles(circleId) {
        const directChildCirclesIds = this.circles
            .filter((circle) => circle.parent_circle_id === circleId)
            .map((circle) => circle.id);

        if (!directChildCirclesIds.length) {
            return [];
        }

        for (const id of directChildCirclesIds) {
            directChildCirclesIds.push(...this.getIndirectChildCircles(id));
        }

        return directChildCirclesIds;
    }

    getIndirectParentCircles(circleId) {
        const circlesArray = [circleId];
        let currentCircleId = circleId;

        while (this.circlesMap[currentCircleId].parent_circle_id) {
            currentCircleId = this.circlesMap[currentCircleId].parent_circle_id;
            circlesArray.push(currentCircleId);
        }

        return circlesArray;
    }

    async fetchPermissionCircles(permission) {
        // 1) get all CirclePermission for this permission
        const circlePermissions = await CirclePermission.findAll({
            where: { permission_id: permission.id }
        });

        // 2) for all the circlePermissions, get their circle
        // and their child circles recursively and push it into map
        const circlesIds = circlePermissions
            .map((circlePermission) => this.getIndirectChildCircles(circlePermission.circle_id))
            .concat(circlePermissions.map((circlePermission) => circlePermission.circle_id))
            .flat();

        const circles = await Circle.findAll({
            where: { id: { [Sequelize.Op.in]: circlesIds } }
        });

        return circles;
    }

    async fetchCurrentUserPermissions() {
        // for superadmin, just assign all the permissions.
        if (this.user.superadmin) {
            const permissions = await Permission.findAll();
            this.addPermissions(permissions);
            return;
        }

        // Fetching permissions.
        // 1) get the list of the circles user's in.
        const directCircleMemberships = await CircleMembership.findAll({
            where: { user_id: this.user.id }
        });

        // 2) fetch all the permissions
        const indirectCirclesArray = helpers.traverseIndirectCircles(this.circlesMap, directCircleMemberships.map((membership) => membership.circle_id));
        const permissions = await Permission.findAll({
            where: {
                '$circle_permissions.circle_id$': { [Sequelize.Op.in]: indirectCirclesArray },
                scope: 'global'
            },
            include: [CirclePermission]
        });

        this.addPermissions(permissions);
    }

    // Get permissions for body
    async fetchBodyPermissions(body) {
        // 1. Get list of circles bound to a body.
        const circleIds = body.circles.map((circle) => circle.id);

        // 2. Get the circle memberships of the body's bound circles for the logged in user.
        const directCircleMemberships = await CircleMembership.findAll({
            where: { circle_id: { [Sequelize.Op.in]: circleIds }, user_id: this.user.id }
        });

        // 3. Fetch all the local permissions.
        const indirectCirclesArray = helpers.traverseIndirectCircles(this.circlesMap, directCircleMemberships.map((membership) => membership.circle_id));
        const permissions = await Permission.findAll({
            where: {
                '$circle_permissions.circle_id$': { [Sequelize.Op.in]: indirectCirclesArray },
                scope: 'local'
            },
            include: [CirclePermission]
        });

        this.addPermissions(permissions);
    }

    async fetchUserPermissions(user) {
        // 1. Fetch the user's bodies and permission the current user has within them:
        // - fetch user bodies
        // - find all the circles inside these bodies
        // - find all the circle memberships for this circles for the currert user
        // - traverse them recursively
        const bodyIds = user.bodies.map((body) => body.id);
        const bodyCirclesIds = this.circles
            .filter((circle) => bodyIds.includes(circle.body_id))
            .map((circle) => circle.id);
        const bodyCircleMemberships = await CircleMembership.findAll({
            where: { user_id: this.user.id, circle_id: { [Sequelize.Op.in]: bodyCirclesIds } }
        });
        const bodyCirclesArray = helpers.traverseIndirectCircles(this.circlesMap, bodyCircleMemberships.map((membership) => membership.circle_id));
        const bodyPermissions = await Permission.findAll({
            where: {
                '$circle_permissions.circle_id$': { [Sequelize.Op.in]: bodyCirclesArray },
                scope: 'local'
            },
            include: [CirclePermission]
        });

        this.addPermissions(bodyPermissions);

        // 2. Fetch the user's join requests and permission the current user has within them:
        // - fetch user join requests and their bodies
        // - find all the circles inside these bodies
        // - find all the circle memberships for this circles for the currert user
        // - traverse them recursively
        const joinRequestIds = user.join_requests.map((request) => request.body_id);
        const joinRequestCircleIds = this.circles
            .filter((circle) => joinRequestIds.includes(circle.body_id))
            .map((circle) => circle.id);
        const joinRequestsCircleMemberships = await CircleMembership.findAll({
            where: { user_id: this.user.id, circle_id: { [Sequelize.Op.in]: joinRequestCircleIds } }
        });
        const joinRequestsArray = helpers.traverseIndirectCircles(this.circlesMap, joinRequestsCircleMemberships.map((membership) => membership.circle_id));
        const joinRequestPermissions = await Permission.findAll({
            where: {
                '$circle_permissions.circle_id$': { [Sequelize.Op.in]: joinRequestsArray },
                scope: 'join_request'
            },
            include: [CirclePermission]
        });

        this.addPermissions(joinRequestPermissions);
    }

    async fetchCirclePermissions(circle) {
        // Do nothing if circle is free and not bound to a body.
        if (!circle.body_id) {
            return;
        }

        // If circle is bound, do the same workflow as we do for a body.
        const body = await Body.findOne({
            where: { id: circle.body_id },
            include: [Circle]
        });
        return this.fetchBodyPermissions(body);
    }
}

module.exports = PermissionsManager;
