module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.addColumn(
        'events',
        'vegetarian',
        { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false }
    ),
    down: (queryInterface) => queryInterface.removeColumn('events', 'vegetarian')
};
