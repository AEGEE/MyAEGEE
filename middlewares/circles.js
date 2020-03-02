const { Circle, User, CircleMembership, BodyMembership } = require('../models');
const errors = require('../lib/errors');
const helpers = require('../lib/helpers');
const { sequelize } = require('../lib/sequelize');

exports.listAllCircles = async (req, res) => {
    const result = await Circle.findAndCountAll({
        ...helpers.getPagination(req.query),
        order: helpers.getSorting(req.query)
    });

    return res.json({
        success: true,
        data: result.rows,
        meta: { count: result.count }
    });
};

exports.getCircle = async (req, res) => {
    // TODO: check permissions
    return res.json({
        success: true,
        data: req.currentCircle
    });
};

exports.createCircle = async (req, res) => {
    // TODO: check permissions
    // TODO: filter out fields that are changed in the other way
    const circle = await Circle.create(req.body);
    return res.json({
        success: true,
        data: circle
    });
};

exports.updateCircle = async (req, res) => {
    // TODO: check permissions
    // TODO: filter out fields that are changed in the other way
    // TODO: check if the parent circle's joinable is the same as child circle's one
    await req.currentCircle.update(req.body);
    return res.json({
        success: true,
        data: req.currentCircle
    });
};

exports.deleteCircle = async (req, res) => {
    // TODO: check permissions
    await req.currentCircle.destroy();
    return res.json({
        success: true,
        message: 'Circle is deleted.'
    });
};

exports.setParentCircle = async (req, res) => {
    if (!helpers.isNumber(req.body.parent_circle)) {
        return errors.makeBadRequestError(res, 'The circle ID is not valid.');
    }

    // TODO: check permissions
    const parentCircle = await Circle.findByPk(req.body.parent_circle);
    if (!parentCircle) {
        return errors.makeNotFoundError(res, 'No parent circle found.');
    }

    try {
        // need to check after the update if there are any loops
        await sequelize.transaction(async (t) => {
            await req.currentCircle.update({ parent_circle_id: parentCircle.id }, { transaction: t });
            await Circle.throwIfAnyLoops(t);
        });
    } catch (err) {
        return errors.makeValidationError(res, err);
    }

    return res.json({
        success: true,
        message: 'Circle parent is updated.'
    });
};

exports.createCircleMembership = async (req, res) => {
    if (!helpers.isNumber(req.params.user_id)) {
        return errors.makeBadRequestError(res, 'The user ID is not valid.');
    }

    const user = await User.findByPk(req.params.user_id);
    if (!user) {
        return errors.makeNotFoundError(res, 'The user is not found.');
    }

    // if a circle is bound, checking if a person is a member
    if (req.currentCircle.body_id) {
        const membership = await BodyMembership.findOne({
            where: {
                body_id: req.currentCircle.body_id,
                user_id: req.params.user_id
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
