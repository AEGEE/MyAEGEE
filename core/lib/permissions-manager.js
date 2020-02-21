const _ = require('lodash');

const { CircleMembership, CirclePermission, Permission } = require('../models');
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
            if (!this.permissionsMap[permission.id]) {
                this.permissions.push(permission);
                this.permissionsMap[permission.id] = permission;
            }
        }
    }

    getPermissionKeys(combined) {
        const combinedSplit = combined.split(':');
        if (combinedSplit.length === 2) {
            return [
                'global:' + combinedSplit,
                'local:' + combinedSplit,
                'join_request:' + combinedSplit,
            ];
        }

        return [combined];
    }

    hasPermission(permission) {
        const keys = this.getPermissionKeys(permission);
        return keys.some(key => this.permissionsMap[key]);
    }

    getPermissionFilter(permission) {
        const keys = this.getPermissionKeys(permission);
        for (const key of keys) {
            if (this.permissionsMap[key]) {
                return this.permissionsMap[key].filters.length > 0 ? this.permissionsMap[key].filters : undefined;
            }
        }
    }

    async fetchUserPermissions() {
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
}

module.exports = PermissionsManager;
