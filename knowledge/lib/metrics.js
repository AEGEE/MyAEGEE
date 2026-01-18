const {
    Gauge,
    register
} = require('prom-client');

const {
    Course,
    Chapter,
    Page
} = require('../models');
const helpers = require('./helpers');
const { sequelize } = require('./sequelize');

const gaugesList = {
    coursesTotal: new Gauge({
        name: 'knowledge_courses_total',
        help: 'Total amount of knowledge courses'
    }),
    chaptersTotal: new Gauge({
        name: 'knowledge_chapters_total',
        help: 'Total amount of knowledge chapters',
    }),
    pagesTotal: new Gauge({
        name: 'knowledge_pages_total',
        help: 'Total amount of knowledge pages'
    }),
};

exports.getMetrics = async (req, res) => {
    const [
        courses,
        chapters,
        pages
    ] = await Promise.all([
        Course.findAll({
            attributes: [
                [sequelize.fn('COUNT', 'id'), 'value']
            ],
            raw: true
        }),
        Chapter.findAll({
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
    helpers.addGaugeData(gaugesList.chaptersTotal, chapters);
    helpers.addGaugeData(gaugesList.pagesTotal, pages);

    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
};
