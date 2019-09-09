module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn(
            'applications',
            'email',
            { type: Sequelize.STRING, allowNull: false, defaultValue: 'Not set.' }
        );
    },
    down: async (queryInterface) => queryInterface.removeColumn('applications', 'email')
};
