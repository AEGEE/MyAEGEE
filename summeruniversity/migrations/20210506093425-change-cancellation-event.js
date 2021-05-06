module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn(
            'events',
            'fee_payment_date'
        );

        await queryInterface.addColumn(
            'events',
            'cancellation_rules',
            { type: Sequelize.TEXT, allowNull: true }
        );
    },
    down: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn(
            'events',
            'fee_payment_date',
            { type: Sequelize.DATE, allowNull: true }
        );

        await queryInterface.removeColumn(
            'events',
            'cancellation_rules'
        );
    }
};
