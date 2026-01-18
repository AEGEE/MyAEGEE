const { User, CircleMembership, BodyMembership } = require('../models');
const errors = require('../lib/errors');
const helpers = require('../lib/helpers');
const constants = require('../lib/constants');

exports.listCircleMembers = async (req, res) => {
    if (!req.permissions.hasPermission('view_members:circle')) {
        return errors.makeForbiddenError(res, 'Permission view_members:circle is required, but not present.');
    }

    const result = await CircleMembership.findAndCountAll({
        where: {
            ...helpers.filterBy(req.query.query, constants.FIELDS_TO_QUERY.CIRCLE_MEMBERSHIP),
            circle_id: req.currentCircle.id
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

exports.createMembership = async (req, res) => {
    if (!req.permissions.hasPermission('add_member:circle')) {
        return errors.makeForbiddenError(res, 'Permission add_member:circle is required, but not present.');
    }

    if (!helpers.isNumber(req.body.user_id)) {
        return errors.makeBadRequestError(res, 'The user ID is not valid.');
    }

    const user = await User.findByPk(req.body.user_id);
    if (!user) {
        return errors.makeNotFoundError(res, 'The user is not found.');
    }

    // if a circle is bound, checking if a person is a member
    if (req.currentCircle.body_id) {
        const membership = await BodyMembership.findOne({
            where: {
                body_id: req.currentCircle.body_id,
                user_id: req.body.user_id
            }
        });
        if (!membership) {
            return errors.makeForbiddenError(res, 'The user is not a member of the body circle is bound to.');
        }
    }

    const circleMembership = await CircleMembership.create({
        circle_id: req.currentCircle.id,
        user_id: user.id
    });

    return res.json({
        success: true,
        data: circleMembership
    });
};

exports.getMembership = async (req, res) => {
    if (!req.permissions.hasPermission('view_members:circle')) {
        return errors.makeForbiddenError(res, 'Permission view_members:circle is required, but not present.');
    }

    return res.json({
        success: true,
        data: req.currentCircleMembership
    });
};

exports.updateMembership = async (req, res) => {
    if (!req.permissions.hasPermission('update_members:circle')) {
        return errors.makeForbiddenError(res, 'Permission update_members:circle is required, but not present.');
    }

    await req.currentCircleMembership.update({ position: req.body.position });
    return res.json({
        success: true,
        data: req.currentCircleMembership
    });
};

exports.deleteMembership = async (req, res) => {
    if (!req.permissions.hasPermission('delete_members:circle')) {
        return errors.makeForbiddenError(res, 'Permission delete_members:circle is required, but not present.');
    }

    await req.currentCircleMembership.destroy();

    return res.json({
        success: true,
        message: 'Membership is deleted.'
    });
};

exports.deleteOwnMembership = async (req, res) => {
    const circleMembership = await CircleMembership.findOne({
        where: { user_id: req.user.id, circle_id: req.currentCircle.id }
    });

    if (!circleMembership) {
        return errors.makeNotFoundError(res, 'You are not a member.');
    }

    await circleMembership.destroy();

    return res.json({
        success: true,
        message: 'Membership is deleted.'
    });
};
