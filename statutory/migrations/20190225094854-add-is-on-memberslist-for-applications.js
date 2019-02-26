module.exports = {
  up: (queryInterface, Sequelize) => queryInterface.addColumn(
      'applications',
      'is_on_memberslist',
      { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false }
  ),
  down: queryInterface => queryInterface.removeColumn('applications', 'is_on_memberslist')
};
