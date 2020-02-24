const {
    BodyMembership,
    JoinRequest,
    User
} = require('../models');

exports.listAllMemberships = async (req, res) => {
    // TODO: check permissions
    // TOOD: add pagination
    const members = await BodyMembership.findAll({
        where: { body_id: req.currentBody.id },
        include: [User]
    });

    return res.json({
        success: true,
        data: members
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
