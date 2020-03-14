const {
    BodyMembership,
    JoinRequest,
    User
} = require('../models');
const helpers = require('../lib/helpers');
const errors = require('../lib/errors');

exports.listAllMemberships = async (req, res) => {
    if (!req.permissions.hasPermission('view_member:body')) {
        return errors.makeForbiddenError(res, 'Permission view_member:body is required, but not present.');
    }

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
    if (!req.permissions.hasPermission('update_member:body')) {
        return errors.makeForbiddenError(res, 'Permission update_member:body is required, but not present.');
    }

    await req.currentBodyMembership.update({ comment: req.body.comment });
    return res.json({
        success: true,
        data: req.currentBodyMembership
    });
};

exports.deleteMembership = async (req, res) => {
    if (!req.permissions.hasPermission('delete_member:body')) {
        return errors.makeForbiddenError(res, 'Permission delete_member:body is required, but not present.');
    }

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
