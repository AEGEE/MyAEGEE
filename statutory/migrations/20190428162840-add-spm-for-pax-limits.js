module.exports = {
    up: async (queryInterface, Sequelize) => {
        // https://stackoverflow.com/questions/45437924/drop-and-create-enum-with-sequelize-correctly
        await queryInterface.changeColumn(
            'pax_limits',
            'event_type',
            { type: Sequelize.TEXT }
        );
        await queryInterface.sequelize.query('drop type enum_pax_limits_event_type;');
        await queryInterface.changeColumn(
            'pax_limits',
            'event_type',
            { type: Sequelize.ENUM('agora', 'epm', 'spm'), allowNull: false }
        );
    },
    down: async (queryInterface, Sequelize) => {
        await queryInterface.changeColumn(
            'pax_limits',
            'event_type',
            { type: Sequelize.TEXT }
        );
        await queryInterface.sequelize.query('drop type enum_pax_limits_event_type;');
        await queryInterface.changeColumn(
            'pax_limits',
            'event_type',
            { type: Sequelize.ENUM('agora', 'epm'), allowNull: false }
        );
    }
};
