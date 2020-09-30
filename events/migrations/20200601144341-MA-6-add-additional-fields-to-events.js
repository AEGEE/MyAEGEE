const EVENTS_TABLE_NAME = 'events';

module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.sequelize.transaction((t) => {
            return Promise.all([
                queryInterface.addColumn(EVENTS_TABLE_NAME, 'accommodation_type', {
                    type: Sequelize.STRING
                }, { transaction: t }),
                queryInterface.addColumn(EVENTS_TABLE_NAME, 'meals_per_day', {
                    type: Sequelize.INTEGER
                }, { transaction: t }),
                queryInterface.addColumn(EVENTS_TABLE_NAME, 'optional_fee', {
                    type: Sequelize.DECIMAL, allowNull: true
                }, { transaction: t }),
                queryInterface.addColumn(EVENTS_TABLE_NAME, 'optional_programme', {
                    type: Sequelize.TEXT, allowNull: true
                }, { transaction: t }),
                queryInterface.addColumn(EVENTS_TABLE_NAME, 'link_info_travel_country', {
                    type: Sequelize.TEXT, allowNull: true
                }, { transaction: t }),
            ]);
        });
    },
    down: (queryInterface) => {
        return queryInterface.sequelize.transaction((t) => {
            return Promise.all([
                queryInterface.removeColumn(EVENTS_TABLE_NAME, 'accommodation_type', { transaction: t }),
                queryInterface.removeColumn(EVENTS_TABLE_NAME, 'meals_per_day', { transaction: t }),
                queryInterface.removeColumn(EVENTS_TABLE_NAME, 'optional_fee', { transaction: t }),
                queryInterface.removeColumn(EVENTS_TABLE_NAME, 'optional_programme', { transaction: t }),
                queryInterface.removeColumn(EVENTS_TABLE_NAME, 'link_info_travel_country', { transaction: t }),
            ]);
        });
    }
};
