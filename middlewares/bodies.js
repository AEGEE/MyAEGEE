const { Body, BodyMembership, User } = require('../models');

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
    await req.currentBodyMembership.destroy();
    return res.json({
        success: true,
        message: 'Membership is deleted.'
    });
};
