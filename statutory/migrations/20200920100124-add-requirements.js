module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.addColumn(
        'positions',
        'requirements',
        { type: Sequelize.TEXT, allowNull: true, defaultValue: '' }
    ),
    down: (queryInterface) => queryInterface.removeColumn('positions', 'requirements')
};
