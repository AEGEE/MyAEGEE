const {
    User,
    MailConfirmation,
    BodyMembership,
    Campaign
} = require('../models');
const errors = require('../lib/errors');
const helpers = require('../lib/helpers');
const constants = require('../lib/constants');

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
    }, { fields: constants.FIELDS_TO_UPDATE.USER.CREATE });

    // Adding a person to a body if campaign has the autojoin body.
    if (campaign.autojoin_body_id) {
        await BodyMembership.create({
            user_id: user.id,
            body_id: campaign.autojoin_body_id
        });
    }

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
    if (!req.permissions.hasPermission('global:view:campaign')) {
        return errors.makeForbiddenError(res, 'Permission global:view:campaign is required, but not present.');
    }

    const result = await Campaign.findAndCountAll({
        where: helpers.filterBy(req.query.query, constants.FIELDS_TO_QUERY.CAMPAIGNS),
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
    if (!req.permissions.hasPermission('global:view:campaign')) {
        return errors.makeForbiddenError(res, 'Permission global:view:campaign is required, but not present.');
    }

    return res.json({
        success: true,
        data: req.currentCampaign
    });
};

exports.createCampaign = async (req, res) => {
    if (!req.permissions.hasPermission('global:create:campaign')) {
        return errors.makeForbiddenError(res, 'Permission global:create:campaign is required, but not present.');
    }

    // TODO: filter out fields that are changed in the other way
    const circle = await Campaign.create(req.body);
    return res.json({
        success: true,
        data: circle
    });
};

exports.updateCampaign = async (req, res) => {
    if (!req.permissions.hasPermission('global:update:campaign')) {
        return errors.makeForbiddenError(res, 'Permission global:update:campaign is required, but not present.');
    }

    // TODO: filter out fields that are changed in the other way
    await req.currentCampaign.update(req.body);
    return res.json({
        success: true,
        data: req.currentCampaign
    });
};

exports.deleteCampaign = async (req, res) => {
    if (!req.permissions.hasPermission('global:delete:campaign')) {
        return errors.makeForbiddenError(res, 'Permission global:delete:campaign is required, but not present.');
    }

    await req.currentCampaign.destroy();
    return res.json({
        success: true,
        message: 'Campaign is deleted.'
    });
};
