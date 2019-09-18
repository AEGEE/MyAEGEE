const {
    Gauge,
    register
} = require('prom-client');

const {
    Event,
    Application
} = require('../models');
const helpers = require('./helpers');

const createGauge = (name, help, labels = []) => new Gauge({
    name,
    help,
    labelNames: labels
});

const gaugesList = {
    eventsTotal: createGauge('events_total', 'Total amount of events'),
    eventsByType: createGauge('events_by_type', 'Amount of events by type', ['type']),
    eventsByTypeAndStatus: createGauge('events_by_type_and_status', 'Amount of events by type and status', ['type', 'status']),
    applicationsTotal: createGauge('applications_total', 'Total amount of applications'),
    applicationsByEvent: createGauge('applications_by_event', 'Amount of applications by event', ['event_name']),
    applicationsByEventAndStatus: createGauge('applications_by_event_and_status', 'Amount of applications by event and status', ['event_name', 'status']),
    applicationsByEventAndBody: createGauge('applications_by_event_and_body', 'Amount of applications by event and body', ['event_name', 'body_name']),
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
    helpers.addGaugeData(gaugesList.eventsTotal, helpers.countByFields(events, []));
    helpers.addGaugeData(gaugesList.eventsByType, helpers.countByFields(events, ['type']));
    helpers.addGaugeData(gaugesList.eventsByTypeAndStatus, helpers.countByFields(events, ['type', 'status']));

    helpers.addGaugeData(gaugesList.applicationsTotal, helpers.countByFields(applications, []));
    helpers.addGaugeData(gaugesList.applicationsByEvent, helpers.countByFields(applications, ['event_name']));
    helpers.addGaugeData(gaugesList.applicationsByEventAndBody, helpers.countByFields(applications, ['event_name', 'body_name']));
    helpers.addGaugeData(gaugesList.applicationsByEventAndStatus, helpers.countByFields(applications, ['event_name', 'status']));

    res.set('Content-Type', register.contentType);
    res.end(register.metrics());
};
