module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.addColumn(
        'positions',
        'body_id',
        { type: Sequelize.INTEGER, allowNull: true }
    ),
    down: queryInterface => queryInterface.removeColumn('positions', 'body_id')
};
