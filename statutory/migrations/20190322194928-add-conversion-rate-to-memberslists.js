module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.addColumn(
        'memberslists',
        'conversion_rate',
        { type: Sequelize.DECIMAL, allowNull: false, defaultValue: 1 }
    ),
    down: queryInterface => queryInterface.removeColumn('memberslists', 'conversion_rate')
};
