const { Body, User, BodyMembership } = require('../models');
const helpers = require('../lib/helpers');
const constants = require('../lib/constants');

exports.listAllBodies = async (req, res) => {
    const result = await Body.findAndCountAll({
        ...helpers.getPagination(req.query),
        order: helpers.getSorting(req.query)
    });

    return res.json({
        success: true,
        data: result.rows,
        meta: { count: result.count }
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

exports.createMember = async (req, res) => {
    // TODO: check permissions
    // TODD: send mail to a user

    // Confirming user by default
    const password = await helpers.getRandomBytes(constants.TOKEN_LENGTH.PASSWORD);
    const user = await User.create({
        ...req.body,
        password,
        mail_confirmed_at: new Date()
    }, { fields: constants.FIELDS_TO_UPDATE.USER.CREATE });

    const membership = await BodyMembership.create({
        user_id: user.id,
        body_id: req.currentBody.id
    });

    return res.json({
        success: true,
        data: membership
    });
};
