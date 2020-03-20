const { JoinRequest, BodyMembership, User } = require('../models');
const errors = require('../lib/errors');
const helpers = require('../lib/helpers');
const constants = require('../lib/constants');
const { sequelize } = require('../lib/sequelize');

exports.listAllJoinRequests = async (req, res) => {
    if (!req.permissions.hasPermission('view:join_request')) {
        return errors.makeForbiddenError(res, 'Permission view:join_request is required, but not present.');
    }

    const result = await JoinRequest.findAndCountAll({
        where: {
            ...helpers.filterBy(req.query.query, constants.FIELDS_TO_QUERY.JOIN_REQUEST),
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
    const request = await JoinRequest.create({
        user_id: req.user.id,
        body_id: req.currentBody.id,
        motivation: req.body.motivation
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

    if (!['accepted', 'rejected'].includes(req.body.status)) {
        return errors.makeBadRequestError(res, 'The status is invalid.');
    }

    if (req.currentJoinRequest.status !== 'pending') {
        return errors.makeBadRequestError(res, 'The join request was processed already.');
    }

    await sequelize.transaction(async (t) => {
        // if a join request is accepted, then create a new body membership
        // but store the join request (for history)
        // if a join request is rejected, just delete it so a person can reapply.
        if (req.body.status === 'accepted') {
            await BodyMembership.create({
                user_id: req.currentJoinRequest.user_id,
                body_id: req.currentBody.id
            }, { transaction: t });
        } else {
            await req.currentJoinRequest.destroy();
        }
    });

    return res.json({
        success: true,
        message: `The join request was changed to "${req.body.status}".`
    });
};
