const { Body } = require('../models');

exports.listAllBodies = async (req, res) => {
    const bodies = await Body.findAll({});

    return res.json({
        success: true,
        data: bodies
    });
};

exports.getBody = async (req, res) => {
    // TODO: check permissions
    return res.json({
        success: true,
        data: req.currentBody
    });
};

exports.createBody = async (req, res) => {
    // TODO: check permissions
    // TODO: filter out fields that are changed in the other way
    const body = await Body.create(req.body);
    return res.json({
        success: true,
        data: body
    });
};

exports.updateBody = async (req, res) => {
    // TODO: check permissions
    // TODO: filter out fields that are changed in the other way
    await req.currentBody.update(req.body);
    return res.json({
        success: true,
        data: req.currentBody
    });
};

exports.setBodyStatus = async (req, res) => {
    // TODO: check permissions
    await req.currentBody.update({ status: req.body.status });
    return res.json({
        success: true,
        data: req.currentBody
    });
};
