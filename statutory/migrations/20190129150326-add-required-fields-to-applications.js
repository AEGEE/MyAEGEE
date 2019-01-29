module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn(
      'applications',
      'number_of_events_visited',
      { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 }
    );

    await queryInterface.addColumn(
      'applications',
      'meals',
      { type: Sequelize.STRING, allowNull: false, defaultValue: '<Not set.>' }
    );

    await queryInterface.addColumn(
      'applications',
      'allergies',
      { type: Sequelize.TEXT, allowNull: true }
    );
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn(
      'applications',
      'number_of_events_visited'
    );

    await queryInterface.removeColumn(
      'applications',
      'meals'
    );

    await queryInterface.removeColumn(
      'applications',
      'allergies'
    );
  }
};
