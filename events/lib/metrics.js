const {
    Gauge,
    register
} = require('prom-client');

const {
    Event,
    Application
} = require('../models');
const helpers = require('./helpers');
const { sequelize } = require('./sequelize');

const gaugesList = {
    eventsTotal: new Gauge({
        name: 'events_events_total',
        help: 'Total amount of general events',
        labelNames: ['type', 'status', 'deleted']
    }),
    applicationsTotal: new Gauge({
        name: 'events_applications_total',
        help: 'Total amount of general events applications',
        labelNames: ['event_name', 'status', 'body_name']
    }),
};

exports.getMetrics = async (req, res) => {
    const [
        events,
        applications,
    ] = await Promise.all([
        Event.findAll({
            attributes: [
                'type',
                'status',
                'deleted',
                [sequelize.fn('COUNT', 'id'), 'value']
            ],
            group: ['type', 'status', 'deleted'],
            raw: true
        }),
        Application.findAll({
            attributes: [
                'body_name',
                'status',
                [sequelize.col('event.name'), 'event_name'],
                [sequelize.fn('COUNT', 'id'), 'value']
            ],
            group: ['event_name', 'body_name', 'application.status'],
            include: [{
                model: Event,
                attributes: [],
            }],
            raw: true
        }),
    ]);

    // setting gauges with real data
    helpers.addGaugeData(gaugesList.eventsTotal, events);
    helpers.addGaugeData(gaugesList.applicationsTotal, applications);

    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
};
