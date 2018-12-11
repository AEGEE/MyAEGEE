module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn(
            'applications',
            'first_name',
            Sequelize.STRING,
            { allowNull: false, defaultValue: 'Not set.' }
        );

        await queryInterface.addColumn(
            'applications',
            'last_name',
            Sequelize.STRING,
            { allowNull: false, defaultValue: 'Not set.' }
        );

        await queryInterface.addColumn(
            'applications',
            'gender',
            Sequelize.STRING,
            { allowNull: false, defaultValue: 'Not set.' }
        );

        await queryInterface.addColumn(
            'applications',
            'body_name',
            Sequelize.STRING,
            { allowNull: false, defaultValue: 'Not set.' }
        );
    },
    down: async (queryInterface) => {
        await queryInterface.removeColumn('applications', 'body_name');
        await queryInterface.removeColumn('applications', 'gender');
        await queryInterface.removeColumn('applications', 'last_name');
        await queryInterface.removeColumn('applications', 'first_name');
    }
};
