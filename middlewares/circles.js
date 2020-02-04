const { Circle } = require('../models');
const errors = require('../lib/errors');

exports.listAllCircles = async (req, res) => {
    const circle = await Circle.findAll({});

    return res.json({
        success: true,
        data: circle
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
    // TODO: check permissions
    const parentCircle = await Circle.findByPk(req.body.id);
    if (!parentCircle) {
        return errors.makeNotFoundError(res, 'No parent circle found.');
    }

    await req.currentCircle.update({ parent_circle_id: parentCircle.id });

    // TODO: check if there are any loops in the chain.

    return res.json({
        success: true,
        message: 'Circle parent is updated.'
    });
};
