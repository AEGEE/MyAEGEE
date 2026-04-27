module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.changeColumn(
            'events',
            'type',
            { type: Sequelize.TEXT }
        );
        await queryInterface.sequelize.query('drop type enum_events_type;');
        await queryInterface.changeColumn(
            'events',
            'type',
            { type: Sequelize.ENUM('training', 'nwm', 'conference', 'cultural', 'thematic'), allowNull: false }
        );
    },
    down: async (queryInterface, Sequelize) => {
        await queryInterface.changeColumn(
            'events',
            'type',
            { type: Sequelize.TEXT }
        );
        await queryInterface.sequelize.query('drop type enum_events_type;');
        await queryInterface.sequelize.query('update events set type = \'cultural\' where type = \'thematic\';');
        await queryInterface.changeColumn(
            'events',
            'type',
            { type: Sequelize.ENUM('training', 'nwm', 'conference', 'cultural'), allowNull: false }
        );
    }
};
