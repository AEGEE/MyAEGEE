const { JoinRequest, BodyMembership } = require('../models');
const errors = require('../lib/errors');
const helpers = require('../lib/helpers');
const { sequelize } = require('../lib/sequelize');

exports.listAllJoinRequests = async (req, res) => {
    // TODO: check permissions
    const result = await JoinRequest.findAndCountAll({
        where: { body_id: req.currentBody.id },
        ...helpers.getPagination(req.query),
        order: helpers.getSorting(req.query)
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
    // TODO: check permissions
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
        message: `The join request was ${req.body.status}.`
    });
};
