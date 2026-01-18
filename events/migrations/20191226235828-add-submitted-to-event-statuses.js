module.exports = {
    up: async (queryInterface, Sequelize) => {
        // https://stackoverflow.com/questions/45437924/drop-and-create-enum-with-sequelize-correctly
        await queryInterface.changeColumn(
            'events',
            'status',
            { type: Sequelize.TEXT }
        );
        await queryInterface.sequelize.query('drop type enum_events_status;');
        await queryInterface.changeColumn(
            'events',
            'status',
            { type: Sequelize.ENUM('draft', 'submitted', 'published'), allowNull: false }
        );
    },
    down: async (queryInterface, Sequelize) => {
        await queryInterface.changeColumn(
            'events',
            'status',
            { type: Sequelize.TEXT }
        );
        await queryInterface.sequelize.query('drop type enum_events_status;');
        await queryInterface.changeColumn(
            'events',
            'status',
            { type: Sequelize.ENUM('draft', 'requesting', 'published'), allowNull: false }
        );
    }
};
