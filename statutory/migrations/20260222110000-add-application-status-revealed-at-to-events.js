module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.addColumn(
        'events',
        'application_status_revealed_at',
        { type: Sequelize.DATE, allowNull: true }
    ),
    down: (queryInterface) => queryInterface.removeColumn('events', 'application_status_revealed_at')
};
