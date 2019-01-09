module.exports = {
  up: (queryInterface, Sequelize) => queryInterface.addColumn(
      'applications',
      'registered',
      Sequelize.BOOLEAN,
      { allowNull: false, defaultValue: false }
  ),
  down: (queryInterface, Sequelize) => queryInterface.removeColumn('applications', 'registered')
};
