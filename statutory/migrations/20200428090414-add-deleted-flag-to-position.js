module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.addColumn(
        'positions',
        'deleted',
        { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false }
    ),
    down: queryInterface => queryInterface.removeColumn('positions', 'deleted')
};
