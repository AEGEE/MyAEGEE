module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.addColumn(
        'events',
        'locations',
        {
            type: Sequelize.JSONB,
            allowNull: false,
            defaultValue: []
        }
    ),
    down: queryInterface => queryInterface.removeColumn('events', 'locations')
};
