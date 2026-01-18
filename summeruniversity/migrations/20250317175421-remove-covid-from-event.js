module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Change 'status' column to remove different covid options
        await queryInterface.changeColumn(
            'events',
            'status',
            { type: Sequelize.TEXT }
        );
        await queryInterface.sequelize.query('drop type if exists enum_events_status;');
        await queryInterface.sequelize.query('update events set status = \'second approval\' where status in (\'second approval\', \'covid draft\', \'covid submission\', \'covid approval\');');
        await queryInterface.changeColumn(
            'events',
            'status',
            { type: Sequelize.ENUM('first draft', 'first submission', 'first approval', 'second draft', 'second submission', 'second approval'), allowNull: false }
        );

        // Change 'published' column to remove "covid" as an option
        await queryInterface.changeColumn(
            'events',
            'published',
            { type: Sequelize.TEXT }
        );
        await queryInterface.sequelize.query('drop type if exists enum_events_published;');
        await queryInterface.sequelize.query('update events set published = \'full\' where published in (\'full\', \'covid\');');
        await queryInterface.changeColumn(
            'events',
            'published',
            { type: Sequelize.ENUM('none', 'minimal', 'full'), allowNull: false }
        );

        // Remove 'covid regulation' column
        await queryInterface.removeColumn(
            'events',
            'covid_regulations'
        );
    },
    down: async (queryInterface, Sequelize) => {
        await queryInterface.changeColumn(
            'events',
            'status',
            { type: Sequelize.TEXT }
        );
        await queryInterface.sequelize.query('drop type if exists enum_events_status;');
        await queryInterface.changeColumn(
            'events',
            'status',
            { type: Sequelize.ENUM('first draft', 'first submission', 'first approval', 'second draft', 'second submission', 'second approval', 'covid draft', 'covid submission', 'covid draft'), allowNull: false }
        );

        await queryInterface.changeColumn(
            'events',
            'published',
            { type: Sequelize.TEXT }
        );
        await queryInterface.sequelize.query('drop type if exists enum_events_published;');
        await queryInterface.changeColumn(
            'events',
            'published',
            { type: Sequelize.ENUM('none', 'minimal', 'full', 'covid'), allowNull: false }
        );

        await queryInterface.addColumn(
            'events',
            'covid_regulations',
            { type: Sequelize.TEXT, allowNull: true }
        );
    }
};
