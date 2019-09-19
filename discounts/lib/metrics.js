const {
    Gauge,
    register
} = require('prom-client');

const {
    Integration,
    Code,
    Category
} = require('../models');
const helpers = require('./helpers');

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
    let [
        integrations,
        codes,
        categories
    ] = await Promise.all([
        Integration.findAll(),
        Code.findAll({ include: [Integration] }),
        Category.findAll()
    ]);

    const partners = categories
        .map((category) => category.toJSON())
        .map((category) => {
            for (const discount of category.discounts) {
                discount.category_name = category.name;
            }

            return category.discounts;
        }).flat();

    categories = categories.map((category) => category.toJSON());
    integrations = integrations.map((integration) => integration.toJSON());
    codes = codes.map((code) => Object.assign(code.toJSON(), {
        integration_name: code.integration.name,
        claimed: code.claimed_by !== null
    }));

    // setting gauges with real data
    helpers.addGaugeData(gaugesList.categoriesTotal, helpers.countByFields(categories));
    helpers.addGaugeData(gaugesList.partnersTotal, helpers.countByFields(partners, ['category_name']));
    helpers.addGaugeData(gaugesList.integrationsTotal, helpers.countByFields(integrations));
    helpers.addGaugeData(gaugesList.codesTotal, helpers.countByFields(codes, ['integration_name', 'claimed']));

    res.set('Content-Type', register.contentType);
    res.end(register.metrics());
};
