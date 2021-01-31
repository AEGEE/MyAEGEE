const {
    Gauge,
    register
} = require('prom-client');

const {
    Event
} = require('../models');
const helpers = require('./helpers');
const { sequelize } = require('./sequelize');

const gaugesList = {
    eventsTotal: new Gauge({
        name: 'summeruniversity_events_total',
        help: 'Total amount of Summer Universities',
        labelNames: ['type', 'status', 'deleted']
    }),
};

exports.getMetrics = async (req, res) => {
    const [
        events,
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
    ]);

    // setting gauges with real data
    helpers.addGaugeData(gaugesList.eventsTotal, events);

    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
};
