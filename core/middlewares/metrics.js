const {
    Gauge,
    register
} = require('prom-client');

const {
    Body,
    User
} = require('../models');
const helpers = require('../lib/helpers');
const { sequelize } = require('../lib/sequelize');

const gaugesList = {
    membersTotal: new Gauge({
        name: 'core_members_total',
        help: 'Total amount of core members',
        labelNames: ['active']
    }),
    bodiesTotal: new Gauge({
        name: 'core_bodies_total',
        help: 'Total amount of core bodies',
        labelNames: ['status', 'type']
    }),
    circlesTotal: new Gauge({
        name: 'core_circles_total',
        help: 'Total amount of core circles',
        labelNames: ['body_id', 'body_name']
    }),
    bodyMembershipsTotal: new Gauge({
        name: 'core_body_memberships_total',
        help: 'Total amount of core body memberships',
        labelNames: ['body_id', 'body_name']
    }),
    circleMembershipsTotal: new Gauge({
        name: 'core_circle_memberships_total',
        help: 'Total amount of core circle memberships',
        labelNames: ['circle_id', 'circle_name']
    }),
    joinRequestsTotal: new Gauge({
        name: 'core_join_requests_total',
        help: 'Total amount of core join requests',
        labelNames: ['body_id', 'body_name', 'status']
    })
};

exports.getMetrics = async (req, res) => {
    const [
        members,
        bodies,
        circles,
        bodyMemberships,
        circleMemberships,
        joinRequests
    ] = await Promise.all([
        User.findAll({
            attributes: [
                'active',
                [sequelize.fn('COUNT', 'id'), 'value']
            ],
            group: ['active'],
            raw: true
        }),
        Body.findAll({
            attributes: [
                'status',
                'type',
                [sequelize.fn('COUNT', 'id'), 'value']
            ],
            group: ['status', 'type'],
            raw: true
        }),
        sequelize.query(
            'SELECT body_id, bodies.name AS body_name, COUNT(*) AS value '
            + 'FROM circles INNER JOIN bodies ON circles.body_id = bodies.id '
            + 'GROUP BY body_id, body_name',
            { type: sequelize.QueryTypes.SELECT }
        ),
        sequelize.query(
            'SELECT body_id, bodies.name AS body_name, COUNT(*) AS value '
            + 'FROM body_memberships INNER JOIN bodies ON body_memberships.body_id = bodies.id '
            + 'GROUP BY body_id, body_name',
            { type: sequelize.QueryTypes.SELECT }
        ),
        sequelize.query(
            'SELECT circle_id, circles.name AS circle_name, COUNT(*) AS value '
            + 'FROM circle_memberships INNER JOIN circles ON circle_memberships.circle_id = circles.id '
            + 'GROUP BY circle_id, circle_name',
            { type: sequelize.QueryTypes.SELECT }
        ),
        sequelize.query(
            'SELECT body_id, bodies.name AS body_name, join_requests.status AS status, COUNT(*) AS value '
            + 'FROM join_requests INNER JOIN bodies ON join_requests.body_id = bodies.id '
            + 'GROUP BY body_id, body_name, join_requests.status',
            { type: sequelize.QueryTypes.SELECT }
        )
    ]);

    // setting gauges with real data
    helpers.addGaugeData(gaugesList.membersTotal, members);
    helpers.addGaugeData(gaugesList.bodiesTotal, bodies);
    helpers.addGaugeData(gaugesList.circlesTotal, circles);
    helpers.addGaugeData(gaugesList.bodyMembershipsTotal, bodyMemberships);
    helpers.addGaugeData(gaugesList.circleMembershipsTotal, circleMemberships);
    helpers.addGaugeData(gaugesList.joinRequestsTotal, joinRequests);

    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
};
