const {
    User,
    MailConfirmation,
    Body,
    BodyMembership,
    Campaign
} = require('../models');
const errors = require('../lib/errors');
const helpers = require('../lib/helpers');
const constants = require('../lib/constants');
const { sequelize } = require('../lib/sequelize');
const mailer = require('../lib/mailer');

exports.registerUser = async (req, res) => {
    const campaign = await Campaign.findOne({ where: { url: req.params.campaign_id } });
    if (!campaign) {
        return errors.makeNotFoundError(res, 'Campaign is not found.');
    }
    if (!campaign.active) {
        return errors.makeForbiddenError(res, 'Campaign is not active.');
    }

    let created;

    await sequelize.transaction(async (t) => {
        const user = await User.scope('noExtraFields').create({
            ...req.body,
            campaign_id: campaign.id
        }, {
            fields: [
                ...constants.FIELDS_TO_UPDATE.USER.CREATE,
                'campaign_id'
            ],
            transaction: t
        });

        // Adding a person to a body if campaign has the autojoin body.
        if (campaign.autojoin_body_id) {
            await BodyMembership.create({
                user_id: user.id,
                body_id: campaign.autojoin_body_id
            }, { transaction: t });
        }

        const confirmation = await MailConfirmation.createForUser(user.id, t);

        await mailer.sendMail({
            to: user.notification_email,
            subject: constants.MAIL_SUBJECTS.MAIL_CONFIRMATION,
            template: 'confirm_email.html',
            parameters: {
                name: user.first_name,
                surname: user.last_name,
                token: confirmation.value
            }
        });

        created = user;
    });

    // The member as every other route returns it: as stored, and without the password.
    return res.json({
        success: true,
        data: await User.findByPk(created.id)
    });
};

exports.listAllCampaigns = async (req, res) => {
    if (!req.permissions.hasPermission('global:view:campaign')) {
        return errors.makeForbiddenError(res, 'Permission global:view:campaign is required, but not present.');
    }

    const result = await Campaign.findAndCountAll({
        where: helpers.filterBy(req.query.query, constants.FIELDS_TO_QUERY.CAMPAIGN),
        ...helpers.getPagination(req.query),
        order: helpers.getSorting(req.query, Campaign)
    });

    return res.json({
        success: true,
        data: result.rows,
        meta: { count: result.count }
    });
};

exports.getCampaign = async (req, res) => {
    if (!req.user || !req.permissions.hasPermission('global:create:campaign')) {
        req.currentCampaign = helpers.whitelistObject(req.currentCampaign, constants.PUBLIC_FIELDS.CAMPAIGN);
    }

    if (req.currentCampaign.autojoin_body) {
        req.currentCampaign.autojoin_body = helpers.whitelistObject(req.currentCampaign.autojoin_body, ['id', 'name', 'email', 'phone', 'address', 'website']);
    }

    return res.json({
        success: true,
        data: req.currentCampaign
    });
};

// The fields of a campaign from a request body. The body that new members join is looked up:
// `autojoinBodyError` is set if it's given and not the ID of a body.
const getCampaignFields = async (body, allowedFields) => {
    const fields = helpers.whitelistObject(body, [...allowedFields, 'autojoin_body_id']);

    if (fields.autojoin_body_id === undefined || fields.autojoin_body_id === null) {
        return { fields };
    }

    const bodyId = helpers.parseId(fields.autojoin_body_id);
    if (!bodyId || await Body.count({ where: { id: bodyId } }) === 0) {
        return { autojoinBodyError: { autojoin_body_id: ['The body does not exist.'] } };
    }

    return { fields: { ...fields, autojoin_body_id: bodyId } };
};

exports.createCampaign = async (req, res) => {
    if (!req.permissions.hasPermission('global:create:campaign')) {
        return errors.makeForbiddenError(res, 'Permission global:create:campaign is required, but not present.');
    }

    const { fields, autojoinBodyError } = await getCampaignFields(req.body, constants.FIELDS_TO_UPDATE.CAMPAIGN.CREATE);
    if (autojoinBodyError) {
        return errors.makeValidationError(res, autojoinBodyError);
    }

    const campaign = await Campaign.create(fields);
    return res.json({
        success: true,
        data: campaign
    });
};

exports.updateCampaign = async (req, res) => {
    if (!req.permissions.hasPermission('global:update:campaign')) {
        return errors.makeForbiddenError(res, 'Permission global:update:campaign is required, but not present.');
    }

    const { fields, autojoinBodyError } = await getCampaignFields(req.body, constants.FIELDS_TO_UPDATE.CAMPAIGN.UPDATE);
    if (autojoinBodyError) {
        return errors.makeValidationError(res, autojoinBodyError);
    }

    await req.currentCampaign.update(fields);
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

exports.listCampaignMembers = async (req, res) => {
    if (!req.permissions.hasPermission('global:view:member')) {
        return errors.makeForbiddenError(res, 'Permission global:view:member is required, but not present.');
    }

    const result = await User.findAndCountAll({
        where: {
            ...helpers.filterBy(req.query.query, constants.FIELDS_TO_QUERY.MEMBER),
            campaign_id: req.currentCampaign.id
        },
        ...helpers.getPagination(req.query),
        order: helpers.getSorting(req.query, User)
    });

    return res.json({
        success: true,
        data: result.rows,
        meta: { count: result.count }
    });
};
