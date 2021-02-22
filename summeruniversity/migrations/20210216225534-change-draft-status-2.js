module.exports = {
    up: async (queryInterface) => {
        await queryInterface.sequelize.query('update events set status = \'first draft\' where status = \'first_draft\';');
        await queryInterface.sequelize.query('update events set status = \'first submission\' where status = \'first_submission\';');
        await queryInterface.sequelize.query('update events set status = \'first approval\' where status = \'first_approval\';');
        await queryInterface.sequelize.query('update events set status = \'second draft\' where status = \'second_draft\';');
        await queryInterface.sequelize.query('update events set status = \'second submission\' where status = \'second_submission\';');
        await queryInterface.sequelize.query('update events set status = \'second approval\' where status = \'second_approval\';');
    },
    down: async (queryInterface) => {
        await queryInterface.sequelize.query('update events set status = \'first_draft\' where status = \'first draft\';');
        await queryInterface.sequelize.query('update events set status = \'first_submission\' where status = \'first submission\';');
        await queryInterface.sequelize.query('update events set status = \'first_approval\' where status = \'first approval\';');
        await queryInterface.sequelize.query('update events set status = \'second_draft\' where status = \'second draft\';');
        await queryInterface.sequelize.query('update events set status = \'second_submission\' where status = \'second submission\';');
        await queryInterface.sequelize.query('update events set status = \'second_approval\' where status = \'second approval\';');
    }
};
