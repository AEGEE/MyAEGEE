module.exports = {
    up: async (queryInterface) => {
        // https://stackoverflow.com/questions/1771543/adding-a-new-value-to-an-existing-enum-type
        await queryInterface.sequelize.query('alter type enum_applications_status add value \'waiting_list\';');
    },
    down: async (queryInterface, Sequelize) => {
        // there's no easy way to delete value from enum in SQL, so just recreating the enum and resetting the value to it
        // changing to TEXT is required to preserve current values
        await queryInterface.changeColumn(
            'applications',
            'status',
            { type: Sequelize.TEXT }
        );
        await queryInterface.sequelize.query('drop type if exists enum_applications_status;');
        await queryInterface.sequelize.query('create type enum_applications_status as enum (\'pending\', \'accepted\', \'rejected\');');
        await queryInterface.sequelize.query('alter table applications alter column status type enum_applications_status using status::enum_applications_status;');
        await queryInterface.sequelize.query('alter table applications alter column status set default \'pending\';');
    }
};
