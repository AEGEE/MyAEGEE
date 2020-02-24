const {
    User,
    MailConfirmation,
    Campaign
} = require('../models');
const errors = require('../lib/errors');
const helpers = require('../lib/helpers');

exports.registerUser = async (req, res) => {
    const campaign = await Campaign.findOne({ where: { url: req.params.campaign_id } });
    if (!campaign) {
        return errors.makeNotFoundError(res, 'Campaign is not found.');
    }
    if (!campaign.active) {
        return errors.makeForbiddenError(res, 'Campaign is not active.');
    }

    const user = await User.scope('noExtraFields').create({
        ...req.body,
        campaign_id: campaign.id
    });
    const confirmation = await MailConfirmation.createForUser(user.id);

    return res.json({
        success: true,
        data: {
            user,
            confirmation
        }
    });
};

exports.listAllCampaigns = async (req, res) => {
    const result = await Campaign.findAndCountAll({
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
        data: req.currentCampaign
    });
};

exports.createCampaign = async (req, res) => {
    // TODO: check permissions
    // TODO: filter out fields that are changed in the other way
    const circle = await Campaign.create(req.body);
    return res.json({
        success: true,
        data: circle
    });
};

exports.updateCampaign = async (req, res) => {
    // TODO: check permissions
    // TODO: filter out fields that are changed in the other way
    await req.currentCampaign.update(req.body);
    return res.json({
        success: true,
        data: req.currentCampaign
    });
};

exports.deleteCampaign = async (req, res) => {
    // TODO: check permissions
    await req.currentCampaign.destroy();
    return res.json({
        success: true,
        message: 'Campaign is deleted.'
    });
};
