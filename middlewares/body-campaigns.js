const { Campaign, User } = require('../models');
const helpers = require('../lib/helpers');
const errors = require('../lib/errors');
const constants = require('../lib/constants');

exports.listAllCampaigns = async (req, res) => {
    if (!req.permissions.hasPermission('view:campaign')) {
        return errors.makeForbiddenError(res, 'Permission view:campaign is required, but not present.');
    }

    const result = await Campaign.findAndCountAll({
        where: {
            autojoin_body_id: req.currentBody.id,
            ...helpers.filterBy(req.query.query, constants.FIELDS_TO_QUERY.CAMPAIGN)
        },
        ...helpers.getPagination(req.query),
        order: helpers.getSorting(req.query)
    });

    return res.json({
        success: true,
        data: result.rows,
        meta: { count: result.count }
    });
};

exports.getCampaign = async (req, res) => {
    if (!req.permissions.hasPermission('view:campaign')) {
        return errors.makeForbiddenError(res, 'Permission view:campaign is required, but not present.');
    }

    return res.json({
        success: true,
        data: req.currentBodyCampaign
    });
};

exports.createCampaign = async (req, res) => {
    if (!req.permissions.hasPermission('create:campaign')) {
        return errors.makeForbiddenError(res, 'Permission create:campaign is required, but not present.');
    }

    // TODO: filter out fields that are changed in the other way
    const circle = await Campaign.create({
        ...req.body,
        body_id: req.currentBody.idd
    });

    return res.json({
        success: true,
        data: circle
    });
};

exports.updateCampaign = async (req, res) => {
    if (!req.permissions.hasPermission('update:campaign')) {
        return errors.makeForbiddenError(res, 'Permission update:campaign is required, but not present.');
    }

    // TODO: filter out fields that are changed in the other way
    await req.currentBodyCampaign.update(req.body);
    return res.json({
        success: true,
        data: req.currentBodyCampaign
    });
};

exports.deleteCampaign = async (req, res) => {
    if (!req.permissions.hasPermission('delete:campaign')) {
        return errors.makeForbiddenError(res, 'Permission delete:campaign is required, but not present.');
    }

    await req.currentBodyCampaign.destroy();
    return res.json({
        success: true,
        message: 'Campaign is deleted.'
    });
};

exports.listCampaignMembers = async (req, res) => {
    if (!req.permissions.hasPermission('view:member')) {
        return errors.makeForbiddenError(res, 'Permission view:member is required, but not present.');
    }

    const result = await User.findAndCountAll({
        where: {
            ...helpers.filterBy(req.query.query, constants.FIELDS_TO_QUERY.MEMBER),
            campaign_id: req.currentBodyCampaign.id
        },
        ...helpers.getPagination(req.query),
        order: helpers.getSorting(req.query)
    });

    return res.json({
        success: true,
        data: result.rows,
        meta: { count: result.count }
    });
};
