const {
    Gauge,
    register
} = require('prom-client');

const {
    Event,
    Application,
    MembersList,
    Position,
    Candidate
} = require('../models');
const helpers = require('./helpers');

const createGauge = (name, help, labels = []) => new Gauge({
    name,
    help,
    labelNames: labels
});

const gaugesList = {
    eventsTotal: createGauge('events_total', 'Total amount of statutory events'),
    eventsByType: createGauge('events_by_type', 'Amount of events by type', ['type']),
    eventsByTypeAndStatus: createGauge('events_by_type_and_status', 'Amount of events by type and status', ['type', 'status']),
    applicationsTotal: createGauge('applications_total', 'Total amount of applications'),
    applicationsByEvent: createGauge('applications_by_event', 'Amount of applications by event', ['event_name']),
    applicationsByEventAndBody: createGauge('applications_by_event_and_body', 'Amount of applications by event and body', ['event_name', 'body_name']),
    applicationsByEventAndPaxType: createGauge(
        'applications_by_event_and_pax_type',
        'Amount of applications by event and pax type',
        ['event_name', 'participant_type']
    ),
    memberslistsTotal: createGauge('memberslists_total', 'Total amount of memberslists'),
    memberslistsByEvent: createGauge('memberslists_by_event', 'Amount of memberslists by event', ['event_name']),
    memberslistsByEventAndBody: createGauge('memberslists_by_event_and_body', 'Amount of memberslists by event and body', ['event_name', 'body_id']),
    positionsTotal: createGauge('positions_total', 'Total amount of positions'),
    positionsByEvent: createGauge('positions_by_event', 'Amount of positions by event', ['event_name']),
    candidatesTotal: createGauge('candidates_total', 'Total amount of candidates'),
    candidatesByStatus: createGauge('candidates_by_status', 'Amount of candidates by status', ['status']),
    candidatesByStatusAndPosition: createGauge(
        'candidates_by_status_and_position',
        'Amount of candidates by status and position',
        ['status', 'position_name', 'event_name']
    ),

};

exports.getMetrics = async (req, res) => {
    let [
        events,
        applications,
        memberslists,
        positions,
        candidates
    ] = await Promise.all([
        Event.findAll(),
        Application.findAll({ include: [Event] }),
        MembersList.findAll({ include: [Event] }),
        Position.findAll({ include: [Event] }),
        Candidate.findAll({ include: [{ model: Position, include: [Event] }] })
    ]);

    events = events.map(event => event.toJSON());
    applications = applications.map(application => Object.assign(application.toJSON(), { event_name: application.event.name }));
    memberslists = memberslists.map(memberslist => Object.assign(memberslist.toJSON(), {
        event_name: memberslist.event.name,
        members_amount: memberslist.members.length
    }));
    positions = positions.map(position => Object.assign(position.toJSON(), { event_name: position.event.name }));
    candidates = candidates.map(candidate => Object.assign(candidate.toJSON(), {
        event_name: candidate.position.event.name,
        position_name: candidate.position.name
    }));


    const memberslistsByBody = memberslists.map(memberslist => ({
        event_name: memberslist.event_name,
        body_id: memberslist.body_id,
        value: memberslist.members_amount
    }));

    // setting gauges with real data
    helpers.addGaugeData(gaugesList.eventsTotal, helpers.countByFields(events, []));
    helpers.addGaugeData(gaugesList.eventsByType, helpers.countByFields(events, ['type']));
    helpers.addGaugeData(gaugesList.eventsByTypeAndStatus, helpers.countByFields(events, ['type', 'status']));

    helpers.addGaugeData(gaugesList.applicationsTotal, helpers.countByFields(applications, []));
    helpers.addGaugeData(gaugesList.applicationsByEvent, helpers.countByFields(applications, ['event_name']));
    helpers.addGaugeData(gaugesList.applicationsByEventAndBody, helpers.countByFields(applications, ['event_name', 'body_name']));
    helpers.addGaugeData(gaugesList.applicationsByEventAndPaxType, helpers.countByFields(applications, ['event_name', 'participant_type']));

    helpers.addGaugeData(gaugesList.memberslistsTotal, helpers.countByFields(memberslists, []));
    helpers.addGaugeData(gaugesList.memberslistsByEvent, helpers.countByFields(memberslists, ['event_name']));
    helpers.addGaugeData(gaugesList.memberslistsByEventAndBody, memberslistsByBody);

    helpers.addGaugeData(gaugesList.positionsTotal, helpers.countByFields(positions, []));
    helpers.addGaugeData(gaugesList.positionsByEvent, helpers.countByFields(positions, ['event_name']));

    helpers.addGaugeData(gaugesList.candidatesTotal, helpers.countByFields(candidates, []));
    helpers.addGaugeData(gaugesList.candidatesByStatus, helpers.countByFields(candidates, ['status']));
    helpers.addGaugeData(gaugesList.candidatesByStatusAndPosition, helpers.countByFields(candidates, ['status', 'position_name', 'event_name']));

    res.set('Content-Type', register.contentType);
    res.end(register.metrics());
};
