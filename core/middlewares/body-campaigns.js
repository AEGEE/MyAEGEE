const { Campaign } = require('../models');
const helpers = require('../lib/helpers');

exports.listAllCampaigns = async (req, res) => {
    const result = await Campaign.findAndCountAll({
        where: { autojoin_body_id: req.currentBody.id },
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
    // TODO: check permissions
    return res.json({
        success: true,
        data: req.currentBodyCampaign
    });
};

exports.createCampaign = async (req, res) => {
    // TODO: check permissions
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
    // TODO: check permissions
    // TODO: filter out fields that are changed in the other way
    await req.currentBodyCampaign.update(req.body);
    return res.json({
        success: true,
        data: req.currentBodyCampaign
    });
};

exports.deleteCampaign = async (req, res) => {
    // TODO: check permissions
    await req.currentBodyCampaign.destroy();
    return res.json({
        success: true,
        message: 'Campaign is deleted.'
    });
};
