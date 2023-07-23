const {
    Gauge,
    register
} = require('prom-client');

const {
    Integration,
    Category
} = require('../models');
const helpers = require('./helpers');
const { sequelize } = require('./sequelize');

const gaugesList = {
    categoriesTotal: new Gauge({
        name: 'discounts_categories_total',
        help: 'Total amount of discounts categories',
    }),
    partnersTotal: new Gauge({
        name: 'discounts_partners_total',
        help: 'Total amount of discounts partners',
        labelNames: ['category_name']
    }),
    integrationsTotal: new Gauge({
        name: 'discounts_integrations_total',
        help: 'Total amount of discounts integrations'
    }),
    codesTotal: new Gauge({
        name: 'discounts_codes_total',
        help: 'Total amount of discount codes',
        labelNames: ['integration_name', 'claimed']
    }),
};

exports.getMetrics = async (req, res) => {
    const [
        integrations,
        codes,
        categories,
        partners
    ] = await Promise.all([
        Integration.findAll({
            attributes: [
                [sequelize.fn('COUNT', 'id'), 'value']
            ],
            raw: true
        }),
        sequelize.query(
            'SELECT COUNT(codes.id) AS value, (codes.claimed_by IS NOT NULL) AS claimed, integrations.name AS integration_name '
            + 'FROM codes, integrations '
            + 'WHERE codes.integration_id = integrations.id '
            + 'GROUP BY claimed, integration_name',
            { type: sequelize.QueryTypes.SELECT }
        ),
        Category.findAll({
            attributes: [
                [sequelize.fn('COUNT', 'id'), 'value']
            ],
            raw: true
        }),
        sequelize.query(
            'SELECT categories.name AS category_name, COUNT(*) AS value '
            + 'FROM categories, jsonb_array_elements(categories.discounts) AS partners '
            + 'GROUP BY categories.id, categories.name',
            { type: sequelize.QueryTypes.SELECT }
        )
    ]);

    // setting gauges with real data
    helpers.addGaugeData(gaugesList.categoriesTotal, categories);
    helpers.addGaugeData(gaugesList.partnersTotal, partners);
    helpers.addGaugeData(gaugesList.integrationsTotal, integrations);
    helpers.addGaugeData(gaugesList.codesTotal, codes);

    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
};
