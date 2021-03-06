const {
    Gauge,
    register
} = require('prom-client');

const {
    Course,
    Category,
    Page
} = require('../models');
const helpers = require('./helpers');
const { sequelize } = require('./sequelize');

const gaugesList = {
    coursesTotal: new Gauge({
        name: 'knowledge_courses_total',
        help: 'Total amount of knowledge courses'
    }),
    categoriesTotal: new Gauge({
        name: 'knowledge_categories_total',
        help: 'Total amount of knowledge categories',
    }),
    pagesTotal: new Gauge({
        name: 'knowledge_pages_total',
        help: 'Total amount of knowledge pages'
    }),
};

exports.getMetrics = async (req, res) => {
    const [
        courses,
        categories,
        pages
    ] = await Promise.all([
        Course.findAll({
            attributes: [
                [sequelize.fn('COUNT', 'id'), 'value']
            ],
            raw: true
        }),
        Category.findAll({
            attributes: [
                [sequelize.fn('COUNT', 'id'), 'value']
            ],
            raw: true
        }),
        Page.findAll({
            attributes: [
                [sequelize.fn('COUNT', 'id'), 'value']
            ],
            raw: true
        })
    ]);

    // setting gauges with real data
    helpers.addGaugeData(gaugesList.coursesTotal, courses);
    helpers.addGaugeData(gaugesList.categoriesTotal, categories);
    helpers.addGaugeData(gaugesList.pagesTotal, pages);

    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
};
