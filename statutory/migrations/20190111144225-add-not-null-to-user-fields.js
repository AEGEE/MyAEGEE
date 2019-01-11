module.exports = {
  up: async (queryInterface, Sequelize) => {
      await queryInterface.changeColumn(
          'applications',
          'first_name',
          { type: Sequelize.STRING, allowNull: false, defaultValue: 'Not set.' }
      );

      await queryInterface.changeColumn(
          'applications',
          'last_name',
          { type: Sequelize.STRING, allowNull: false, defaultValue: 'Not set.' }
      );

      await queryInterface.changeColumn(
          'applications',
          'gender',
          { type: Sequelize.STRING, allowNull: false, defaultValue: 'Not set.' }
      );

      await queryInterface.changeColumn(
          'applications',
          'body_name',
          { type: Sequelize.STRING, allowNull: false, defaultValue: 'Not set.' }
      );

      await queryInterface.changeColumn(
          'applications',
          'email',
          { type: Sequelize.STRING, allowNull: false, defaultValue: 'test@example.com' }
      );
  },
  down: async (queryInterface) => {
      await queryInterface.changeColumn('applications', 'body_name', Sequelize.STRING);
      await queryInterface.changeColumn('applications', 'gender', Sequelize.STRING);
      await queryInterface.changeColumn('applications', 'last_name', Sequelize.STRING);
      await queryInterface.changeColumn('applications', 'first_name', Sequelize.STRING);
      await queryInterface.changeColumn('applications', 'email', Sequelize.STRING);
  }
};
