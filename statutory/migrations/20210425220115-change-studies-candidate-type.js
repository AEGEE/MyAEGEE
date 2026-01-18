module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.changeColumn(
            'candidates',
            'studies',
            { type: Sequelize.TEXT }
        );
    },
    down: async (queryInterface, Sequelize) => {
        await queryInterface.changeColumn(
            'candidates',
            'studies',
            { type: Sequelize.STRING }
        );
    }
};
