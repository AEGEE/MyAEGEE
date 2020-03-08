
module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.changeColumn(
            'events',
            'type',
            { type: Sequelize.TEXT }
        );
        await queryInterface.sequelize.query('drop type enum_events_type;');
        await queryInterface.sequelize.query('update events set type = \'training\' where type in (\'es\', \'ltc\', \'rtc\' );');
        await queryInterface.sequelize.query('update events set type = \'conference\' where type in (\'european\' );');
        await queryInterface.sequelize.query('update events set type = \'cultural\' where type in (\'wu\');');
        await queryInterface.changeColumn(
            'events',
            'type',
            { type: Sequelize.ENUM('training', 'nwm', 'conference', 'cultural'), allowNull: false }
        );
    },
    down: async (queryInterface, Sequelize) => {
        await queryInterface.changeColumn(
            'events',
            'type',
            { type: Sequelize.TEXT }
        );
        await queryInterface.sequelize.query('drop type enum_events_type;');
        await queryInterface.sequelize.query('update events set type = \'european\' where type in (\'training\', \'cultural\', \'conference\' ;');
        await queryInterface.changeColumn(
            'events',
            'type',
            { type: Sequelize.ENUM('wu', 'es', 'nwm', 'ltc', 'rtc', 'european'), allowNull: false }
        );
    }
};
