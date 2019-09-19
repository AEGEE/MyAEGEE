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

const gaugesList = {
    eventsTotal: new Gauge({
        name: 'statutory_events_total',
        help: 'Total amount of statutory events',
        labelNames: ['type', 'status']
    }),
    applicationsTotal: new Gauge({
        name: 'statutory_applications_total',
        help: 'Total amount of statutory applications',
        labelNames: ['event_name', 'body_name', 'participant_type']
    }),
    memberslistsTotal: new Gauge({
        name: 'statutory_memberslists_total',
        help: 'Total amount of statutory memberslists',
        labelNames: ['event_name', 'body_name']
    }),
    memberslistsByEventAndBody: new Gauge({
        name: 'statutory_memberslists_by_event_and_body',
        help: 'Amount of memberslists by event body',
        labelNames: ['event_name', 'body_id']
    }),
    positionsTotal: new Gauge({
        name: 'statutory_positions_total',
        help: 'Total amount of statutory positions',
        labelNames: ['event_name']
    }),
    candidatesTotal: new Gauge({
        name: 'statutory_candidates_total',
        help: 'Total amount of statutory candidates',
        labelNames: ['status', 'position_name', 'event_name']
    })
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
    helpers.addGaugeData(gaugesList.eventsTotal, helpers.countByFields(events, ['type', 'status']));
    helpers.addGaugeData(gaugesList.applicationsTotal, helpers.countByFields(applications, ['event_name', 'body_name', 'participant_type']));
    helpers.addGaugeData(gaugesList.memberslistsTotal, helpers.countByFields(memberslists, ['event_name']));
    helpers.addGaugeData(gaugesList.memberslistsByEventAndBody, memberslistsByBody);
    helpers.addGaugeData(gaugesList.positionsTotal, helpers.countByFields(positions, ['event_name']));
    helpers.addGaugeData(gaugesList.candidatesTotal, helpers.countByFields(candidates, ['status', 'position_name', 'event_name']));

    res.set('Content-Type', register.contentType);
    res.end(register.metrics());
};
