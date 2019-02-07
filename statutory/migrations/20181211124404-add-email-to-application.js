module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn(
            'applications',
            'email',
            Sequelize.STRING,
            { allowNull: false, defaultValue: 'test@example.com' }
        );
    },
    down: async (queryInterface) => {
        await queryInterface.removeColumn('applications', 'email');
    }
};
