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
const logger = require('../lib/logger');
const Bugsnag = require('../lib/bugsnag');
const metrics = require('./metrics');

exports.registerUser = async (req, res) => {
    const campaign = await Campaign.findOne({ where: { url: req.params.campaign_id } });
    if (!campaign) {
        return errors.makeNotFoundError(res, 'Campaign is not found.');
    }
    if (!campaign.active) {
        return errors.makeForbiddenError(res, 'Campaign is not active.');
    }

    // The member, the membership and the confirmation are stored and committed first, and
    // mailed after that, so that a slow mailer holds no database connection.
    const { user, confirmation } = await sequelize.transaction(async (t) => {
        const created = await User.scope('noExtraFields').create({
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
                user_id: created.id,
                body_id: campaign.autojoin_body_id
            }, { transaction: t });
        }

        return { user: created, confirmation: await MailConfirmation.createForUser(created.id, t) };
    });

    try {
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
    } catch (err) {
        logger.error({ err, user_id: user.id, campaign_id: campaign.id }, 'Could not send the confirmation of a signup');
        metrics.signupMailFailures.inc();
        Bugsnag.notify(err);

        // A member who cannot confirm their address is of no use: the signup is undone, so that
        // the same username and address can sign up again. The circle membership that joining
        // the body gave goes with the member.
        await sequelize.transaction(async (t) => {
            await MailConfirmation.destroy({ where: { user_id: user.id }, transaction: t });
            await BodyMembership.destroy({ where: { user_id: user.id }, transaction: t });
            await User.destroy({ where: { id: user.id }, transaction: t });
        });

        return errors.makeMailError(res);
    }

    // The member as every other route returns it: as stored, and without the password.
    return res.json({
        success: true,
        data: await User.findByPk(user.id)
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
    // A plain object: a field that is set on the model instance would not reach the answer.
    let campaign = req.currentCampaign.toJSON();

    if (!req.user || !req.permissions.hasPermission('global:create:campaign')) {
        campaign = helpers.whitelistObject(campaign, constants.PUBLIC_FIELDS.CAMPAIGN);
    }

    if (campaign.autojoin_body) {
        campaign.autojoin_body = helpers.whitelistObject(campaign.autojoin_body, ['id', 'name', 'email', 'phone', 'address', 'website']);
    }

    return res.json({
        success: true,
        data: campaign
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
    // The answer shows the body that is stored now, not the one that was loaded before the update.
    await req.currentCampaign.reload();
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
