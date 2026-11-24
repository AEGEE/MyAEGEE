const { JoinRequest, BodyMembership, User, CircleMembership, Permission } = require('../models');
const errors = require('../lib/errors');
const helpers = require('../lib/helpers');
const constants = require('../lib/constants');
const logger = require('../lib/logger');
const { reportMailFailure } = require('../lib/mail-failures');
const mailer = require('../lib/mailer');
const { Sequelize, sequelize } = require('../lib/sequelize');
const config = require('../config');

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
        order: helpers.getSorting(req.query, JoinRequest),
        include: [User]
    });

    return res.json({
        success: true,
        data: result.rows,
        meta: { count: result.count }
    });
};

// The mails to the boards that are sent after the answer, until they are sent or failed.
const pendingBoardMails = new Set();

// For the tests: resolves when the mails to the boards about the join requests so far are sent or failed.
exports.waitForBoardMails = () => Promise.all(pendingBoardMails);

// Tells the board, and the members who process its join requests, about a new join request.
// The mail carries no token, so a failure does not undo the request: it is logged and reported.
const tellBoard = async ({ body, user, permissions }, request) => {
    try {
        const recipients = [body.email];

        // Fetching a permission.
        const permission = await Permission.findOne({
            where: {
                scope: 'local',
                action: 'process',
                object: 'join_request'
            }
        });

        if (!permission) {
            logger.warn('No local:process:join_request permission, only sending mail to body email.');
        } else {
            const circles = await permissions.fetchPermissionCircles(permission);
            const localCircles = circles.filter((circle) => circle.body_id === body.id);

            if (!localCircles.length) {
                logger.debug('No local circles, only sending mail to body email.');
            } else {
                const members = await User.findAll({
                    where: { '$circle_memberships.circle_id$': { [Sequelize.Op.in]: localCircles.map((circle) => circle.id) } },
                    include: [CircleMembership]
                });

                if (!members.length) {
                    logger.debug('No members with local:process:join_request permission, only sending mail to body email.');
                }

                recipients.push(...members.map((member) => member.notification_email));
            }
        }

        await mailer.sendMail({
            to: recipients,
            subject: constants.MAIL_SUBJECTS.NEW_JOIN_REQUEST,
            template: 'member_joined.html',
            parameters: {
                member_firstname: user.first_name,
                member_lastname: user.last_name,
                body_name: body.name,
                body_id: body.id
            }
        });
    } catch (err) {
        reportMailFailure(err, 'Could not tell the board about a join request', {
            user_id: user.id,
            body_id: body.id,
            join_request_id: request.id
        });
    }
};

exports.createJoinRequest = async (req, res) => {
    if (req.currentBody.status === 'deleted') {
        return errors.makeValidationError(res, 'This body is deleted and does not take join requests.');
    }

    if (req.user.bodies.some((body) => body.id === req.currentBody.id)) {
        return errors.makeValidationError(res, 'You are already a member of this body.');
    }

    const request = await JoinRequest.create({
        user_id: req.user.id,
        body_id: req.currentBody.id,
        motivation: req.body.motivation
    });

    // The board is told after the answer, so that the member does not wait for the mailer.
    const job = tellBoard({ body: req.currentBody, user: req.user, permissions: req.permissions }, request)
        .finally(() => pendingBoardMails.delete(job));
    pendingBoardMails.add(job);

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

                await mailer.sendMail({
                    to: config.google_workspace_notifications,
                    subject: constants.MAIL_SUBJECTS.WORKSPACE_NEW_MEMBER,
                    template: 'workspace_new_member.html',
                    parameters: {
                        member_firstname: user.first_name,
                        member_lastname: user.last_name,
                        user_id: user.id,
                        member_email: user.email
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
