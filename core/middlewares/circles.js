const { Circle } = require('../models');
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
