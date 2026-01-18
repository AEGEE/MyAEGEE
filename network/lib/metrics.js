const {
    Gauge,
    register
} = require('prom-client');

const { Board } = require('../models');
const helpers = require('./helpers');
const { sequelize } = require('./sequelize');

const gaugesList = {
    boardsTotal: new Gauge({
        name: 'network_boards_total',
        help: 'Total amount of boards',
    })
};

exports.getMetrics = async (req, res) => {
    const [boards] = await Promise.all([
        Board.findAll({
            attributes: [
                [sequelize.fn('COUNT', 'id'), 'value']
            ],
            raw: true
        })
    ]);

    // setting gauges with real data
    helpers.addGaugeData(gaugesList.boardsTotal, boards);

    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
};
