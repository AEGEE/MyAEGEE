const { Integration } = require('../models');
const errors = require('./errors')

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
    const isNumber = !Number.isNaN(Number(req.params.integration_id));

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

exports.updateIntegration = async (req, res) => {
    if (!req.permissions.manage_discounts) {
        return errors.makeForbiddenError(res, 'You are not allowed to update integration.');
    }

    await req.integration.update(req.body);

    return res.json({
        success: true,
        data: req.integration
    })
};

exports.deleteIntegration = async (req, res) => {
    if (!req.permissions.manage_discounts) {
        return errors.makeForbiddenError(res, 'You are not allowed to update integration.');
    }

    await req.integration.destroy();

    return res.json({
        success: true,
        data: req.integration
    })
};
