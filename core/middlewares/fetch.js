const errors = require('../lib/errors');
const helpers = require('../lib/helpers');
const {
    User,
    Body,
    Circle,
    Permission,
    Campaign,
    BodyMembership,
    JoinRequest
} = require('../models');

const { Sequelize } = require('../lib/sequelize');

exports.fetchUser = async (req, res, next) => {
    if (req.params.user_id === 'me') {
        req.currentUser = req.user;
        return next();
    }

    // searching the user by url
    let where = { username: { [Sequelize.Op.iLike]: req.params.user_id } };

    // searching the user by id if it's numeric
    if (helpers.isNumber(req.params.user_id)) {
        where = { id: Number(req.params.user_id) };
    }

    const user = await User.findOne({ where });
    if (!user) {
        return errors.makeNotFoundError(res, 'User is not found.');
    }

    req.currentUser = user;

    // TODO: fetch permissions

    return next();
};

exports.fetchBody = async (req, res, next) => {
    // searching the body by code
    let where = { code: { [Sequelize.Op.iLike]: req.params.body_id } };

    // searching the body by id if it's numeric
    if (helpers.isNumber(req.params.body_id)) {
        where = { id: Number(req.params.body_id) };
    }

    const body = await Body.findOne({ where });
    if (!body) {
        return errors.makeNotFoundError(res, 'Body is not found.');
    }

    req.currentBody = body;

    // TODO: fetch permissions

    return next();
};

exports.fetchCircle = async (req, res, next) => {
    // searching the circle by id if it's numeric
    if (!helpers.isNumber(req.params.circle_id)) {
        return errors.makeBadRequestError(res, 'Circle ID is invalid.');
    }

    const circle = await Circle.findOne({
        where: { id: Number(req.params.circle_id) },
        include: [
            { model: Circle, as: 'child_circles' },
            { model: Circle, as: 'parent_circle' }
        ]
    });
    if (!circle) {
        return errors.makeNotFoundError(res, 'Circle is not found.');
    }

    req.currentCircle = circle;

    // TODO: fetch permissions

    return next();
};

exports.fetchPermission = async (req, res, next) => {
    // searching the circle by id if it's numeric
    if (!helpers.isNumber(req.params.permission_id)) {
        return errors.makeBadRequestError(res, 'Permission ID is invalid.');
    }

    const permission = await Permission.findOne({
        where: { id: Number(req.params.permission_id) },
        include: [
            { model: Circle, as: 'circles' },
        ]
    });
    if (!permission) {
        return errors.makeNotFoundError(res, 'Permission is not found.');
    }

    req.currentPermission = permission;

    // TODO: fetch permissions

    return next();
};

exports.fetchCampaign = async (req, res, next) => {
    // searching the campaign by id if it's numeric
    if (!helpers.isNumber(req.params.campaign_id)) {
        return errors.makeBadRequestError(res, 'Campaign ID is invalid.');
    }

    const campaign = await Campaign.findOne({
        where: { id: Number(req.params.campaign_id) }
    });
    if (!campaign) {
        return errors.makeNotFoundError(res, 'Campaign is not found.');
    }

    req.currentCampaign = campaign;

    // TODO: fetch permissions

    return next();
};

exports.fetchMembership = async (req, res, next) => {
    // searching the campaign by id if it's numeric
    if (!helpers.isNumber(req.params.membership_id)) {
        return errors.makeBadRequestError(res, 'Membership ID is invalid.');
    }

    const membership = await BodyMembership.findOne({
        where: {
            id: Number(req.params.membership_id),
            body_id: Number(req.params.body_id)
        }
    });
    if (!membership) {
        return errors.makeNotFoundError(res, 'Membership is not found.');
    }

    req.currentBodyMembership = membership;
    return next();
};

exports.fetchJoinRequest = async (req, res, next) => {
    // searching the campaign by id if it's numeric
    if (!helpers.isNumber(req.params.request_id)) {
        return errors.makeBadRequestError(res, 'Join request ID is invalid.');
    }

    const request = await JoinRequest.findOne({
        where: {
            id: Number(req.params.request_id),
            body_id: Number(req.params.body_id)
        }
    });
    if (!request) {
        return errors.makeNotFoundError(res, 'Join request is not found.');
    }

    req.currentJoinRequest = request;
    return next();
};
