const {
    Gauge,
    register
} = require('prom-client');

const {
    Event,
    Application,
    MembersList,
    Position,
} = require('../models');
const helpers = require('./helpers');
const { sequelize } = require('./sequelize');

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
    const [
        events,
        applications,
        memberslists,
        memberslistsByBody,
        positions,
        candidates
    ] = await Promise.all([
        Event.findAll({
            attributes: [
                'type',
                'status',
                [sequelize.fn('COUNT', 'id'), 'value']
            ],
            group: ['type', 'status'],
            raw: true
        }),
        Application.findAll({
            attributes: [
                'body_name',
                'participant_type',
                [sequelize.col('event.name'), 'event_name'],
                [sequelize.fn('COUNT', 'id'), 'value']
            ],
            group: ['event_name', 'body_name', 'participant_type'],
            include: [{
                model: Event,
                attributes: [],
            }],
            raw: true
        }),
        MembersList.findAll({
            attributes: [
                [sequelize.col('event.name'), 'event_name'],
                [sequelize.fn('COUNT', 'id'), 'value']
            ],
            group: ['event_name'],
            include: [{
                model: Event,
                attributes: [],
            }],
            raw: true
        }),
        MembersList.findAll({
            attributes: [
                'body_id',
                [sequelize.col('event.name'), 'event_name'],
                [sequelize.fn('jsonb_array_length', sequelize.col('members')), 'value']
            ],
            include: [{
                model: Event,
                attributes: [],
            }],
            raw: true
        }),
        Position.findAll({
            attributes: [
                [sequelize.col('event.name'), 'event_name'],
                [sequelize.fn('COUNT', 'id'), 'value']
            ],
            group: ['event_name'],
            include: [{
                model: Event,
                attributes: [],
            }],
            raw: true
        }),
        sequelize.query(
            'SELECT positions.status AS status, positions.name AS position_name, events.name AS event_name, COUNT(candidates.id) AS value '
            + 'FROM candidates, positions, events '
            + 'WHERE positions.id = candidates.position_id '
            + 'AND events.id = positions.event_id '
            + 'GROUP BY position_name, event_name, positions.status',
            { type: sequelize.QueryTypes.SELECT }
        )
    ]);

    // setting gauges with real data
    helpers.addGaugeData(gaugesList.eventsTotal, events);
    helpers.addGaugeData(gaugesList.applicationsTotal, applications);
    helpers.addGaugeData(gaugesList.memberslistsTotal, memberslists);
    helpers.addGaugeData(gaugesList.memberslistsByEventAndBody, memberslistsByBody);
    helpers.addGaugeData(gaugesList.positionsTotal, positions);
    helpers.addGaugeData(gaugesList.candidatesTotal, candidates);

    res.set('Content-Type', register.contentType);
    res.end(register.metrics());
};
