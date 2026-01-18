module.exports = {
    up: async (queryInterface, Sequelize) => {
        // https://stackoverflow.com/questions/45437924/drop-and-create-enum-with-sequelize-correctly
        await queryInterface.changeColumn(
            'events',
            'type',
            { type: Sequelize.TEXT }
        );
        await queryInterface.sequelize.query('drop type enum_events_type;');
        await queryInterface.sequelize.query('update events set type = \'european\' where type in (\'local\', \'other\');');
        await queryInterface.changeColumn(
            'events',
            'type',
            { type: Sequelize.ENUM('wu', 'es', 'nwm', 'ltc', 'rtc', 'european'), allowNull: false }
        );
    },
    down: async (queryInterface, Sequelize) => {
        await queryInterface.changeColumn(
            'events',
            'type',
            { type: Sequelize.TEXT }
        );
        await queryInterface.sequelize.query('drop type enum_events_type;');
        await queryInterface.sequelize.query('update events set type = \'other\' where type ilike  \'european\';');
        await queryInterface.changeColumn(
            'events',
            'type',
            { type: Sequelize.ENUM('wu', 'es', 'nwm', 'ltc', 'rtc', 'local', 'other'), allowNull: false }
        );
    }
};
