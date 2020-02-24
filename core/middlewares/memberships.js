const {
    BodyMembership,
    JoinRequest,
    User
} = require('../models');
const helpers = require('../lib/helpers');

exports.listAllMemberships = async (req, res) => {
    // TODO: check permissions
    const result = await BodyMembership.findAndCountAll({
        where: { body_id: req.currentBody.id },
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

exports.updateMembership = async (req, res) => {
    await req.currentBodyMembership.update({ comment: req.body.comment });
    return res.json({
        success: true,
        data: req.currentBodyMembership
    });
};

exports.deleteMembership = async (req, res) => {
    // delete all join requests if any, so a person can reapply
    await JoinRequest.destroy({
        where: {
            user_id: req.currentBodyMembership.user_id,
            body_id: req.currentBody.id
        }
    });
    await req.currentBodyMembership.destroy();

    return res.json({
        success: true,
        message: 'Membership is deleted.'
    });
};
