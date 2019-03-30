module.exports = {
  up: (queryInterface, Sequelize) => queryInterface.addColumn(
      'memberslists',
      'fee_paid',
      { type: Sequelize.DECIMAL, allowNull: false, defaultValue: 0 }
  ),
  down: queryInterface => queryInterface.removeColumn('memberslists', 'fee_paid')
};
