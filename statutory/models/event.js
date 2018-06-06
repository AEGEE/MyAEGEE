const { Sequelize, sequelize } = require('../lib/sequelize');

const Event = sequelize.define('Event', {
    name: Sequelize.STRING,
    starts: Sequelize.DATE,
    ends: Sequelize.DATE,
    description: Sequelize.TEXT,
    status: Sequelize.ENUM('draft', 'requesting', 'approved'),
    application_period_starts: Sequelize.DATE,
    application_period_ends: Sequelize.DATE,
    locals: Sequelize.ARRAY(Sequelize.INTEGER),
    fee: Sequelize.DECIMAL,
    type: Sequelize.ENUM('agora', 'epm')
}, { underscored: true });

module.exports = Event;
