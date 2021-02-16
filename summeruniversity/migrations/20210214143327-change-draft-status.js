module.exports = {
    up: async (queryInterface) => {
        await queryInterface.sequelize.query('update events set status = \'first_draft\' where status = \'draft\';');
    },
    down: async (queryInterface) => {
        await queryInterface.sequelize.query('update events set status = \'draft\' where status = \'first_draft\';');
    }
};
