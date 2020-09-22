const { Circle, Permission, CirclePermission } = require('../models');
const errors = require('../lib/errors');
const helpers = require('../lib/helpers');
const constants = require('../lib/constants');
const { Sequelize, sequelize } = require('../lib/sequelize');

exports.listAllCircles = async (req, res) => {
    const where = helpers.filterBy(req.query.query, constants.FIELDS_TO_QUERY.CIRCLE);

    // filter out bound circles
    if (!req.query.all) {
        where.body_id = null;
    }

    const result = await Circle.findAndCountAll({
        where,
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
    return res.json({
        success: true,
        data: req.currentCircle
    });
};

exports.getCirclePermissions = async (req, res) => {
    const indirectChildCircles = req.permissions.getIndirectParentCircles(req.currentCircle.id);
    const result = await Permission.findAndCountAll({
        where: { '$circle_permissions.circle_id$': { [Sequelize.Op.in]: indirectChildCircles } },
        include: [CirclePermission]
    });

    return res.json({
        success: true,
        data: result.rows,
        meta: { count: result.count }
    });
};

// This endpoint is for creating free circles only.
exports.createCircle = async (req, res) => {
    if (!req.permissions.hasPermission('global:create:circle')) {
        return errors.makeForbiddenError(res, 'Permission global:create:circle is required, but not present.');
    }

    const circle = await Circle.create(req.body, { fields: constants.FIELDS_TO_UPDATE.CIRCLE.CREATE });
    return res.json({
        success: true,
        data: circle
    });
};

exports.updateCircle = async (req, res) => {
    if (!req.permissions.hasPermission('update:circle')) {
        return errors.makeForbiddenError(res, 'Permission update:circle is required, but not present.');
    }

    // TODO: filter out fields that are changed in the other way
    // TODO: check if the parent circle's joinable is the same as child circle's one
    await req.currentCircle.update(req.body);
    return res.json({
        success: true,
        data: req.currentCircle
    });
};

exports.deleteCircle = async (req, res) => {
    if (!req.permissions.hasPermission('delete:circle')) {
        return errors.makeForbiddenError(res, 'Permission delete:circle is required, but not present.');
    }

    await req.currentCircle.destroy();
    return res.json({
        success: true,
        message: 'Circle is deleted.'
    });
};

exports.setParentCircle = async (req, res) => {
    if (!req.permissions.hasPermission('global:put_parent:circle')) {
        return errors.makeForbiddenError(res, 'Permission global:put_parent:circle is required, but not present.');
    }

    // unsetting parent circle
    if (req.body.parent_circle_id === null) {
        await req.currentCircle.update({ parent_circle_id: null });
        return res.json({
            success: true,
            message: 'Circle parent is unset.'
        });
    }

    // setting parent circle
    if (!helpers.isNumber(req.body.parent_circle_id)) {
        return errors.makeBadRequestError(res, 'The circle ID is not valid.');
    }

    const parentCircle = await Circle.findByPk(req.body.parent_circle_id);
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
