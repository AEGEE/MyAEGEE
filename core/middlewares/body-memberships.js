const {
    Permission,
    BodyMembership,
    CircleMembership,
    Circle,
    User,
} = require('../models');
const helpers = require('../lib/helpers');
const { sequelize, Sequelize } = require('../lib/sequelize');
const mailer = require('../lib/mailer');
const constants = require('../lib/constants');
const errors = require('../lib/errors');
const config = require('../config');

exports.listAllMemberships = async (req, res) => {
    if (req.query.holds_permission) {
        return exports.listAllMembershipsWithPermission(req, res);
    }

    if (!req.permissions.hasPermission('view_members:body')) {
        return errors.makeForbiddenError(
            res,
            'Permission view_members:body is required, but not present.'
        );
    }

    const result = await BodyMembership.findAndCountAll({
        where: {
            body_id: req.currentBody.id,
            ...helpers.filterBy(
                req.query.query,
                constants.FIELDS_TO_QUERY.BODY_MEMBERSHIP
            ),
        },
        ...helpers.getPagination(req.query),
        order: helpers.getSorting(req.query, BodyMembership),
        include: [User],
    });

    return res.json({
        success: true,
        data: result.rows,
        meta: { count: result.count },
    });
};

exports.listAllMembershipsWithPermission = async (req, res) => {
    if (!req.permissions.hasPermission('view_members:body')) {
        return errors.makeForbiddenError(
            res,
            'Permission view_members:body is required, but not present.'
        );
    }

    if (
        !req.query.holds_permission.action
    || !req.query.holds_permission.object
    ) {
        return errors.makeBadRequestError(
            res,
            'Action or object is not specified.'
        );
    }

    const permission = await Permission.findOne({
        where: {
            scope: 'local',
            action: req.query.holds_permission.action,
            object: req.query.holds_permission.object,
        },
    });

    if (!permission) {
        return errors.makeNotFoundError(res, 'Permission is not found.');
    }

    // The circles of this body that have the permission, directly or through a parent circle.
    const circles = await req.permissions.fetchPermissionCircles(permission);
    const circleIds = circles
        .filter((circle) => circle.body_id === req.currentBody.id)
        .map((circle) => circle.id);

    // The members of those circles are looked up first, so the list itself can be counted and
    // cut into pages by membership, and not by the rows of the tables that are joined to it.
    const holders = await CircleMembership.findAll({
        where: { circle_id: { [Sequelize.Op.in]: circleIds } },
        attributes: ['user_id'],
    });
    const holderIds = [...new Set(holders.map((membership) => membership.user_id))];

    const result = await BodyMembership.findAndCountAll({
        where: {
            body_id: req.currentBody.id,
            user_id: { [Sequelize.Op.in]: holderIds },
            ...helpers.filterBy(
                req.query.query,
                constants.FIELDS_TO_QUERY.BODY_MEMBERSHIP
            ),
        },
        ...helpers.getPagination(req.query),
        order: helpers.getSorting(req.query, BodyMembership),
        include: [
            {
                model: User,
                include: [
                    // Only the memberships that give the permission.
                    {
                        model: CircleMembership,
                        where: { circle_id: { [Sequelize.Op.in]: circleIds } },
                        required: false,
                        separate: true,
                        include: [Circle],
                    },
                ],
            },
        ],
    });

    return res.json({
        success: true,
        data: result.rows,
        meta: { count: result.count },
    });
};

exports.getMembership = async (req, res) => {
    if (!req.permissions.hasPermission('view_members:body')) {
        return errors.makeForbiddenError(
            res,
            'Permission view_members:body is required, but not present.'
        );
    }

    return res.json({
        success: true,
        data: req.currentBodyMembership,
    });
};

exports.createMembership = async (req, res) => {
    if (!req.permissions.hasPermission('add_member:body')) {
        return errors.makeForbiddenError(
            res,
            'Permission add_member:body is required, but not present.'
        );
    }

    const userId = helpers.parseId(req.body.user_id);
    if (!userId) {
        return errors.makeBadRequestError(res, 'The user ID is not valid.');
    }

    const user = await User.findByPk(userId);
    if (!user) {
        return errors.makeNotFoundError(res, 'User is not found');
    }

    let membership;

    await sequelize.transaction(async (t) => {
        const bodyCount = await BodyMembership.count({
            where: { user_id: user.id },
        });

        membership = await BodyMembership.create(
            {
                user_id: user.id,
                body_id: req.currentBody.id,
            },
            { transaction: t }
        );

        if (bodyCount === 0) {
            await mailer.sendMail({
                to: user.notification_email,
                subject: constants.MAIL_SUBJECTS.NEW_MEMBER,
                template: 'new_member.html',
                parameters: {
                    member_firstname: user.first_name,
                    member_lastname: user.last_name,
                    body_name: req.currentBody.name,
                    body_id: req.currentBody.id,
                },
            });

            await mailer.sendMail({
                to: config.google_workspace_notifications,
                subject: constants.MAIL_SUBJECTS.WORKSPACE_NEW_MEMBER,
                template: 'workspace_new_member.html',
                parameters: {
                    member_firstname: user.first_name,
                    member_lastname: user.last_name,
                    user_id: user.id,
                    member_email: user.email,
                },
            });
        }
    });

    return res.json({
        success: true,
        data: membership,
    });
};

exports.updateMembership = async (req, res) => {
    if (!req.permissions.hasPermission('update_member:body')) {
        return errors.makeForbiddenError(
            res,
            'Permission update_member:body is required, but not present.'
        );
    }

    await req.currentBodyMembership.update({ comment: req.body.comment });
    return res.json({
        success: true,
        data: req.currentBodyMembership,
    });
};

// A member who is in no body anymore has no right to a Google Workspace account. The Workspace
// administrators are told, so they can remove the account by hand; nothing is removed here.
const notifyWorkspaceAdminsIfLastBody = async (userId) => {
    const bodyCount = await BodyMembership.count({
        where: { user_id: userId },
    });

    if (bodyCount > 0) {
        return;
    }

    const user = await User.findByPk(userId);

    await mailer.sendMail({
        to: config.google_workspace_notifications,
        subject: constants.MAIL_SUBJECTS.WORKSPACE_DELETED_MEMBER,
        template: 'workspace_deleted_member.html',
        parameters: {
            member_firstname: user.first_name,
            member_lastname: user.last_name,
            user_id: user.id,
            member_workspace_email: user.gsuite_id,
        },
    });
};

exports.deleteMembership = async (req, res) => {
    if (!req.permissions.hasPermission('delete_member:body')) {
        return errors.makeForbiddenError(
            res,
            'Permission delete_member:body is required, but not present.'
        );
    }

    await req.currentBodyMembership.destroy();
    await notifyWorkspaceAdminsIfLastBody(req.currentBodyMembership.user_id);

    return res.json({
        success: true,
        message: 'Membership is deleted',
    });
};

exports.deleteOwnMembership = async (req, res) => {
    const bodyMembership = await BodyMembership.findOne({
        where: { user_id: req.user.id, body_id: req.currentBody.id },
    });

    if (!bodyMembership) {
        return errors.makeNotFoundError(res, 'You are not a member.');
    }

    await bodyMembership.destroy();
    await notifyWorkspaceAdminsIfLastBody(req.user.id);

    return res.json({
        success: true,
        message: 'Membership is deleted.',
    });
};
