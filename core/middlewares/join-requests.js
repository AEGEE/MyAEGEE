const { JoinRequest, BodyMembership, User, CircleMembership, Permission } = require('../models');
const errors = require('../lib/errors');
const helpers = require('../lib/helpers');
const constants = require('../lib/constants');
const logger = require('../lib/logger');
const mailer = require('../lib/mailer');
const { Sequelize, sequelize } = require('../lib/sequelize');

exports.listAllJoinRequests = async (req, res) => {
    if (!req.permissions.hasPermission('view:join_request')) {
        return errors.makeForbiddenError(res, 'Permission view:join_request is required, but not present.');
    }

    const result = await JoinRequest.findAndCountAll({
        where: {
            ...helpers.filterBy(req.query.query, constants.FIELDS_TO_QUERY.JOIN_REQUEST),
            ...helpers.findBy(req.query, constants.FIELDS_TO_FIND.JOIN_REQUEST),
            body_id: req.currentBody.id,
        },
        ...helpers.getPagination(req.query),
        order: helpers.getSorting(req.query),
        include: [User]
    });

    return res.json({
        success: true,
        data: result.rows,
        meta: { count: result.count }
    });
};

exports.createJoinRequest = async (req, res) => {
    let request;
    await sequelize.transaction(async (t) => {
        request = await JoinRequest.create({
            user_id: req.user.id,
            body_id: req.currentBody.id,
            motivation: req.body.motivation
        }, { transaction: t });

        // Fetching a permission.
        const permission = await Permission.findOne({
            where: {
                scope: 'local',
                action: 'process',
                object: 'join_request'
            }
        });

        if (!permission) {
            logger.warn('No local:process:join_request permission, not sending mails to board.');
            return;
        }

        const circles = await req.permissions.fetchPermissionCircles(permission);
        const localCircles = circles.filter((circle) => circle.body_id === req.currentBody.id);

        if (!localCircles.length) {
            logger.debug('No local circles, not sending mails to user.');
            return;
        }

        const members = await User.findAll({
            where: { '$circle_memberships.circle_id$': { [Sequelize.Op.in]: localCircles.map((circle) => circle.id) } },
            include: [CircleMembership]
        });

        if (!members.length) {
            logger.debug('No members with local:process:join_request permission, not sending mails to board.');
            return;
        }

        await mailer.sendMail({
            to: members.map((member) => member.notification_email),
            subject: constants.MAIL_SUBJECTS.NEW_JOIN_REQUEST,
            template: 'member_joined.html',
            parameters: {
                member_firstname: req.user.first_name,
                member_lastname: req.user.last_name,
                body_name: req.currentBody.name,
                body_id: req.currentBody.id
            }
        });
    });

    return res.json({
        success: true,
        data: request
    });
};

exports.changeRequestStatus = async (req, res) => {
    if (!req.permissions.hasPermission('process:join_request')) {
        return errors.makeForbiddenError(res, 'Permission process:join_request is required, but not present.');
    }

    if (!['approved', 'rejected'].includes(req.body.status)) {
        return errors.makeBadRequestError(res, 'The status is invalid.');
    }

    if (req.currentJoinRequest.status !== 'pending') {
        return errors.makeBadRequestError(res, 'The join request was processed already.');
    }

    await sequelize.transaction(async (t) => {
        // if a join request is approved, then create a new body membership
        // but store the join request (for history)
        // if a join request is rejected, just delete it so a person can reapply.
        if (req.body.status === 'approved') {
            const bodyCount = await BodyMembership.count({ where: { user_id: req.currentJoinRequest.user_id } });

            await BodyMembership.create({
                user_id: req.currentJoinRequest.user_id,
                body_id: req.currentBody.id
            }, { transaction: t });

            if (bodyCount === 0) {
                const user = await User.findByPk(req.currentJoinRequest.user_id);

                await mailer.sendMail({
                    to: user.notification_email,
                    subject: constants.MAIL_SUBJECTS.NEW_MEMBER,
                    template: 'new_member.html',
                    parameters: {
                        member_firstname: user.first_name,
                        member_lastname: user.last_name,
                        body_name: req.currentBody.name,
                        body_id: req.currentBody.id
                    }
                });
            }

            await req.currentJoinRequest.update({ status: req.body.status }, { transaction: t });
        } else {
            await req.currentJoinRequest.destroy();
        }
    });

    return res.json({
        success: true,
        message: `The join request was changed to "${req.body.status}".`
    });
};
