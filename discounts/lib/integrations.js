const moment = require('moment');

const { Integration, Code } = require('../models');
const { Sequelize } = require('./sequelize');
const errors = require('./errors');
const helpers = require('./helpers');
const mailer = require('./mailer');

exports.createIntegration = async (req, res) => {
    if (!req.permissions.manage_discounts) {
        return errors.makeForbiddenError(res, 'You are not allowed to create integrations.');
    }

    const integration = await Integration.create(req.body);

    return res.json({
        success: true,
        data: integration
    });
};

exports.listAllIntegrations = async (req, res) => {
    const integrations = await Integration.findAll({});

    return res.json({
        success: true,
        data: integrations
    });
};

exports.findIntegration = async (req, res, next) => {
    const isNumber = helpers.isNumber(req.params.integration_id);

    const whereClause = isNumber
        ? { id: Number(req.params.integration_id) }
        : { code: req.params.integration_id };

    const integration = await Integration.findOne({ where: whereClause });

    if (!integration) {
        return errors.makeNotFoundError(res, 'The integration is not found.');
    }

    req.integration = integration;
    return next();
};

exports.getIntegration = async (req, res) => {
    return res.json({
        success: true,
        data: req.integration
    });
};

exports.updateIntegration = async (req, res) => {
    if (!req.permissions.manage_discounts) {
        return errors.makeForbiddenError(res, 'You are not allowed to update integration.');
    }

    await req.integration.update(req.body);

    return res.json({
        success: true,
        data: req.integration
    });
};

exports.deleteIntegration = async (req, res) => {
    if (!req.permissions.manage_discounts) {
        return errors.makeForbiddenError(res, 'You are not allowed to delete integration.');
    }

    await req.integration.destroy();

    return res.json({
        success: true,
        data: req.integration
    });
};

exports.addCodesToIntegration = async (req, res) => {
    if (!req.permissions.manage_discounts) {
        return errors.makeForbiddenError(res, 'You are not allowed to populate codes.');
    }

    if (!Array.isArray(req.body)) {
        return errors.makeBadRequestError(res, 'The body should be an array.');
    }

    if (req.body.length === 0) {
        return errors.makeBadRequestError(res, 'No codes are provided.');
    }

    const arrayToCreate = req.body.map((code) => ({
        integration_id: req.integration.id,
        value: code
    }));

    await Code.bulkCreate(arrayToCreate);

    return res.json({
        success: true,
        message: 'Codes are populated.'
    });
};

exports.claimCode = async (req, res) => {
    // Checking if a user has already claimed more codes than available.
    const startPeriod = moment().startOf(req.integration.quota_period).toDate();
    const endPeriod = moment().endOf(req.integration.quota_period).toDate();

    const existingCodes = await Code.count({
        where: {
            claimed_by: req.user.id,
            integration_id: req.integration.id,
            updated_at: {
                [Sequelize.Op.gte]: startPeriod,
                [Sequelize.Op.lte]: endPeriod
            }
        }
    });

    if (existingCodes >= req.integration.quota_amount) {
        return errors.makeForbiddenError(res, 'Your quota is exceeded for this integration.');
    }

    // Trying to get a random code from DB.
    const codeToClaim = await Code.findOne({
        where: {
            claimed_by: null,
            integration_id: req.integration.id
        }
    });

    // There can be cases when there are no free codes anymore.
    if (!codeToClaim) {
        return errors.makeForbiddenError(res, 'There are no codes left. Wait for CD to add them.');
    }

    await codeToClaim.update({ claimed_by: req.user.id });

    await mailer.sendMail({
        to: req.user.notification_email,
        subject: `Your ${req.integration.name} discount code`,
        template: 'custom.html',
        parameters: {
            body: helpers.getMailText({
                user: req.user,
                integration: req.integration,
                code: codeToClaim
            })
        }
    });

    // TODO: Send mail to user.
    return res.json({
        success: true,
        data: codeToClaim
    });
};

exports.getMyCodes = async (req, res) => {
    const myCodes = await Code.findAll({
        where: {
            claimed_by: req.user.id
        },
        include: [Integration],
        order: [
            ['updated_at', 'DESC'],
        ]
    });

    return res.json({
        success: true,
        data: myCodes
    });
};
