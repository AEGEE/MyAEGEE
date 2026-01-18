module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.changeColumn(
            'events',
            'fee',
            { type: Sequelize.DECIMAL, allowNull: true }
        );
        await queryInterface.changeColumn(
            'events',
            'meals_per_day',
            { type: Sequelize.INTEGER, allowNull: true }
        );
        await queryInterface.changeColumn(
            'events',
            'accommodation_type',
            { type: Sequelize.STRING, allowNull: true }
        );
        await queryInterface.addColumn(
            'events',
            'method',
            { type: Sequelize.ENUM('in person', 'online'), allowNull: false, defaultValue: 'in person' }
        );
        await queryInterface.addColumn(
            'events',
            'is_european_event',
            { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true }
        );
    },
    down: async (queryInterface, Sequelize) => {
        await queryInterface.changeColumn(
            'events',
            'fee',
            { type: Sequelize.DECIMAL, allowNull: false, defaultValue: 0 }
        );
        await queryInterface.changeColumn(
            'events',
            'meals_per_day',
            { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 }
        );
        await queryInterface.changeColumn(
            'events',
            'accommodation_type',
            { type: Sequelize.STRING, allowNull: false }
        );
        await queryInterface.removeColumn('events', 'method');
        await queryInterface.removeColumn('events', 'is_european_event');
    }
};
