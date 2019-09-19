const {
    Gauge,
    register
} = require('prom-client');

const {
    Event,
    Application
} = require('../models');
const helpers = require('./helpers');

const gaugesList = {
    eventsTotal: new Gauge({
        name: 'events_events_total',
        help: 'Total amount of general events',
        labelNames: ['type', 'status']
    }),
    applicationsTotal: new Gauge({
        name: 'events_applications_total',
        help: 'Total amount of general events applications',
        labelNames: ['event_name', 'status', 'body_name']
    }),
};

exports.getMetrics = async (req, res) => {
    let [
        events,
        applications,
    ] = await Promise.all([
        Event.findAll(),
        Application.findAll({ include: [Event] }),
    ]);

    events = events.map((event) => event.toJSON());
    applications = applications.map((application) => Object.assign(application.toJSON(), { event_name: application.event.name }));

    // setting gauges with real data
    helpers.addGaugeData(gaugesList.eventsTotal, helpers.countByFields(events, ['type', 'status']));
    helpers.addGaugeData(gaugesList.applicationsTotal, helpers.countByFields(applications, ['event_name', 'body_name', 'status']));

    res.set('Content-Type', register.contentType);
    res.end(register.metrics());
};
