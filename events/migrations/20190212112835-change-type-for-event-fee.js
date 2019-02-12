module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.changeColumn(
        'events',
        'fee',
        { type: Sequelize.DECIMAL, allowNull: false }
    ),
    down: queryInterface => queryInterface.changeColumn(
        'events',
        'fee',
        { type: Sequelize.INTEGER, allowNull: false }
    )
};
