module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn(
      'applications',
      'statutory_id',
      {
        type: Sequelize.STRING
      }
    );
    await queryInterface.sequelize.query('update applications set statutory_id = LPAD(event_id::text, 3, \'0\') || \'-\' || LPAD(id::text, 4, \'0\');');
    await queryInterface.changeColumn(
      'applications',
      'statutory_id',
      {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      }
    );
  },
  down: queryInterface => queryInterface.removeColumn('applications', 'statutory_id')
};
